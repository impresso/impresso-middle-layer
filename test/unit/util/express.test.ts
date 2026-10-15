import { strict as assert } from 'assert'
import { once } from 'node:events'
import { PassThrough } from 'node:stream'
import express, { type Response } from 'express'
import { FeathersError } from '@feathersjs/errors'
import { customJsonMiddleware } from '@/util/express.js'
import { Limits } from '@/services/provenance/provenance.class.js'

async function parseBody(path: string, chunks: Buffer[]) {
  const request: PassThrough & { path: string; body: unknown; is: () => string } = Object.assign(new PassThrough(), {
    path,
    body: undefined,
    is: () => 'application/json',
  })
  const response: Response = Object.create(express.response)
  const calls: unknown[] = []
  customJsonMiddleware({ bodyLimits: { '/tools/provenance': Limits.bodyBytes } })(request, response, error => {
    calls.push(error)
  })
  const ended = once(request, 'end')
  for (const chunk of chunks) request.write(chunk)
  request.end()
  await ended
  return { calls, body: request.body }
}

function assert413(calls: unknown[]) {
  assert.equal(calls.length, 1)
  assert.ok(calls[0] instanceof FeathersError)
  assert.equal(calls[0].code, 413)
}

describe('custom JSON middleware body limits', () => {
  it('accepts valid JSON exactly at the 2 MiB limit, including a trailing slash', async () => {
    const overhead = Buffer.byteLength(JSON.stringify({ padding: '' }))
    const body = { padding: 'x'.repeat(Limits.bodyBytes - overhead) }
    for (const path of ['/tools/provenance', '/tools/provenance/']) {
      const parsed = await parseBody(path, [Buffer.from(JSON.stringify(body))])
      assert.deepEqual(parsed.calls, [undefined])
      assert.ok(typeof parsed.body === 'object' && parsed.body !== null)
      assert.deepEqual({ ...parsed.body }, body)
    }
  })
  it('rejects oversized input before parsing and calls next once despite later chunks', async () => {
    for (const path of ['/tools/provenance', '/tools/provenance/', '/tools/provenance//']) {
      const parsed = await parseBody(path, [
        Buffer.alloc(Limits.bodyBytes, ' '),
        Buffer.from('x'),
        Buffer.from('{"ignored":true}'),
      ])
      assert413(parsed.calls)
      assert.equal(parsed.body, undefined)
    }
  })
  it('counts UTF-8 bytes rather than characters', async () => {
    const json = JSON.stringify({ padding: 'é'.repeat(Limits.bodyBytes / 2) })
    assert.ok(json.length < Limits.bodyBytes)
    assert.ok(Buffer.byteLength(json) > Limits.bodyBytes)
    const parsed = await parseBody('/tools/provenance', [Buffer.from(json)])
    assert413(parsed.calls)
    assert.equal(parsed.body, undefined)
  })
  it('keeps other routes unrestricted by the provenance policy', async () => {
    const body = { padding: 'x'.repeat(Limits.bodyBytes) }
    const parsed = await parseBody('/other', [Buffer.from(JSON.stringify(body))])
    assert.deepEqual(parsed.calls, [undefined])
    assert.ok(typeof parsed.body === 'object' && parsed.body !== null)
    assert.deepEqual({ ...parsed.body }, body)
  })
})
