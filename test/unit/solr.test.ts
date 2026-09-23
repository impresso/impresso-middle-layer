import { strict as assert } from 'assert'
import { checkResponseStatus, defaultFetchOptions } from '@/solr.js'

describe('Solr fetch error handling', () => {
  it('does not consume native fetch response bodies while logging unsuccessful responses', async () => {
    const response = new Response('{"error":{"msg":"boom","code":500}}', { status: 500 })

    await defaultFetchOptions.onUnsuccessfulResponse?.(
      'https://solr.example.com/core/select',
      'POST',
      '{"query":"hello"}',
      response
    )

    await assert.rejects(
      () => checkResponseStatus(response),
      error => {
        assert.strictEqual((error as Error).message, '500')
        assert.deepStrictEqual((error as any).response, {
          statusCode: 500,
          body: '{"error":{"msg":"boom","code":500}}',
        })
        return true
      }
    )
  })

  it('preserves response status when the body was already consumed', async () => {
    const response = new Response('already read', { status: 503 })
    await response.text()

    await assert.rejects(
      () => checkResponseStatus(response),
      error => {
        assert.strictEqual((error as Error).message, '503')
        assert.deepStrictEqual((error as any).response, {
          statusCode: 503,
          body: '',
        })
        return true
      }
    )
  })
})
