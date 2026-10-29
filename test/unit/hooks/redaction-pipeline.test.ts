import { strict as assert } from 'assert'
import { feathers, type Id, type Params } from '@feathersjs/feathers'
import type { AppServices } from '@/types.js'
import type { Configuration } from '@/configuration.js'
import { AuthorizationBitmapsKey } from '@/models/authorization.js'
import { redactResponse, redactResponseDataItem, unlessHasPermissionAndWithinQuota } from '@/hooks/redaction.js'
import type { RedactionPolicy } from '@/util/redaction.js'
import { safeStringifyJson } from '@/util/jsonCodec.js'

interface Item {
  id: string
  text: { content: string }
  access: { accessBitmaps?: { getTranscript: string } }
  [key: symbol]: unknown
}
interface TestService {
  get(id: Id, params?: Params): Promise<Item>
  find(params?: Params): Promise<{ data: Item[] }>
}

const blanket: RedactionPolicy = {
  name: 'blanket',
  items: [{ jsonPath: '$.access.accessBitmaps', valueConverterName: 'remove' }],
}
const transcript: RedactionPolicy = {
  name: 'transcript',
  items: [{ jsonPath: '$.text.content', valueConverterName: 'redact' }],
}

describe('sequential redaction hooks', () => {
  for (const method of ['get', 'find']) {
    for (const allowed of [false, true]) {
      it(`${method}: blanket redaction preserves the permission decision for ${allowed ? 'public' : 'restricted'} content`, async () => {
        const source: Item = {
          id: 'item',
          text: { content: 'secret' },
          access: { accessBitmaps: { getTranscript: 'internal' } },
          [AuthorizationBitmapsKey]: { getTranscript: allowed ? 1n : 2n },
        }
        const app = feathers<AppServices & Record<string, TestService>, Configuration>()
        app.set('images', {
          baseUrl: '',
          proxy: { sources: [{ id: 'test', endpoint: 'https://example.com' }] },
          rewriteRules: [],
        })
        app.use('redaction-test', {
          async get() {
            return source
          },
          async find() {
            return { data: [source] }
          },
        })
        const service = app.service('redaction-test')
        service.hooks({
          after: {
            get: [
              redactResponse(blanket),
              redactResponse(transcript, unlessHasPermissionAndWithinQuota('getTranscript')),
            ],
            find: [
              redactResponseDataItem(blanket),
              redactResponseDataItem(transcript, unlessHasPermissionAndWithinQuota('getTranscript')),
            ],
          },
        })
        const result = method === 'get' ? await service.get('item') : (await service.find()).data[0]
        assert.equal(result.text.content, allowed ? 'secret' : '[REDACTED]')
        assert.equal(result.access.accessBitmaps, undefined)
        assert.ok(result[AuthorizationBitmapsKey])
        assert.equal(
          safeStringifyJson(result),
          `{"id":"item","text":{"content":"${allowed ? 'secret' : '[REDACTED]'}"},"access":{}}`
        )
        assert.equal(source.text.content, 'secret')
        assert.ok(source.access.accessBitmaps)
      })
    }
  }
})
