import { strict as assert } from 'assert'
import type { HookContext } from '@feathersjs/feathers'
import { BaristaProxy } from '@/services/barista-proxy/barista-proxy.class.js'
import hooks, { BaristaRateLimitResource } from '@/services/barista-proxy/barista-proxy.hooks.js'
import type { ImpressoApplication } from '@/types.js'

describe('barista-proxy rate limiting', () => {
  it('uses an independent rate limiting resource', async () => {
    const calls: Array<{ userId: string; resource: string }> = []
    const context = {
      app: {
        service: (name: string) => {
          assert.equal(name, 'rateLimiter')
          return {
            allow: async (userId: string, resource: string) => {
              calls.push({ userId, resource })
              return { usedTokens: 1, totalTokens: 60, isAllowed: true }
            },
          }
        },
      },
      params: {
        headers: {},
        user: { uid: 'user-1' },
      },
    } as any as HookContext<ImpressoApplication>

    await hooks.around.all[1](context, async () => {})

    assert.deepEqual(calls, [{ userId: 'user-1', resource: BaristaRateLimitResource }])
    assert.deepEqual(context.params.rateLimitingResult, { usedTokens: 1, totalTokens: 60, isAllowed: true })
  })

  it('includes the remaining conversations in the streamed done event', async () => {
    const events: Array<{ name: string; payload: any }> = []
    const service: any = Object.create(BaristaProxy.prototype)
    service.emit = (name: string, payload: any) => events.push({ name, payload })

    const response = {
      body: (async function* () {
        yield Buffer.from('data: {"type":"done"}\n')
      })(),
    }

    await service.handleStream(response, {
      user: { uid: 'user-1' },
      rateLimitingResult: { usedTokens: 12, totalTokens: 60, isAllowed: true },
    })

    assert.deepEqual(events, [
      {
        name: 'barista-response',
        payload: {
          type: 'done',
          data: [],
          userUid: 'user-1',
          remainingConversations: 48,
        },
      },
    ])
  })
})
