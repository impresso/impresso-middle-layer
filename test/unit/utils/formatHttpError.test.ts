import { strict as assert } from 'assert'
import { formatHttpError } from '@/utils/formatHttpError.js'

describe('formatHttpError', () => {
  it('extracts from a Fetch Response with context for request side', async () => {
    const response = new Response('Internal Server Error', { status: 500 })
    const details = await formatHttpError(response, {
      url: 'https://example.com/api',
      requestBody: JSON.stringify({ data: 'hello' }),
    })

    assert.strictEqual(details.requestUrl, 'https://example.com/api')
    assert.strictEqual(details.requestBody, '{"data":"hello"}')
    assert.strictEqual(details.responseStatus, 500)
    assert.strictEqual(details.responseBody, 'Internal Server Error')
  })

  it('extracts from a checkResponseStatus-style error (error.response.body as string)', async () => {
    const error = new Error('500')
    ;(error as any).response = {
      statusCode: 500,
      body: '{"error":{"msg":"boom"}}',
    }
    const details = await formatHttpError(error, {
      url: 'https://solr.example.com/select',
      requestBody: '{"query":"foo"}',
    })

    assert.strictEqual(details.requestUrl, 'https://solr.example.com/select')
    assert.strictEqual(details.requestBody, '{"query":"foo"}')
    assert.strictEqual(details.responseStatus, 500)
    assert.strictEqual(details.responseBody, '{"error":{"msg":"boom"}}')
  })

  it('extracts from an Axios-style error (config + response.data)', async () => {
    const error = {
      config: { url: 'https://api.example.com/ner', data: { text: 'hello' } },
      response: { status: 503, data: { error: 'unavailable' } },
    }
    const details = await formatHttpError(error)

    assert.strictEqual(details.requestUrl, 'https://api.example.com/ner')
    assert.strictEqual(details.requestBody, '{"text":"hello"}')
    assert.strictEqual(details.responseStatus, 503)
    assert.strictEqual(details.responseBody, '{"error":"unavailable"}')
  })

  it('extracts from an undici Dispatcher.ResponseData (statusCode + body stream)', async () => {
    const response = {
      statusCode: 502,
      body: (async function* () {
        yield Buffer.from('Bad Gateway')
      })(),
    }
    const details = await formatHttpError(response, {
      url: 'https://barista.example.com',
      requestBody: { message: 'hi' },
    })

    assert.strictEqual(details.requestUrl, 'https://barista.example.com')
    assert.strictEqual(details.requestBody, '{"message":"hi"}')
    assert.strictEqual(details.responseStatus, 502)
    assert.strictEqual(details.responseBody, 'Bad Gateway')
  })

  it('uses pre-extracted response fields from context', async () => {
    const details = await formatHttpError(new Error('something'), {
      url: 'https://example.com',
      requestBody: 'raw-body',
      responseStatus: 500,
      responseBody: 'raw-response',
    })

    assert.strictEqual(details.requestUrl, 'https://example.com')
    assert.strictEqual(details.requestBody, 'raw-body')
    assert.strictEqual(details.responseStatus, 500)
    assert.strictEqual(details.responseBody, 'raw-response')
  })

  it('handles a plain Error with no HTTP context gracefully', async () => {
    const details = await formatHttpError(new Error('network failure'))

    assert.strictEqual(details.requestUrl, undefined)
    assert.strictEqual(details.requestBody, undefined)
    assert.strictEqual(details.responseStatus, undefined)
    assert.strictEqual(details.responseBody, undefined)
  })

  it('handles null/undefined input without throwing', async () => {
    const details = await formatHttpError(null)
    assert.deepStrictEqual(details, {})
  })

  it('handles a Response whose body has already been consumed', async () => {
    const response = new Response('already read', { status: 500 })
    await response.text() // consume the body

    const details = await formatHttpError(response, {
      url: 'https://example.com',
      requestBody: 'body',
    })

    assert.strictEqual(details.responseStatus, 500)
    assert.strictEqual(details.responseStatus, 500)
    assert.strictEqual(details.responseBody, undefined)
  })

  it('serialises non-string request bodies from context', async () => {
    const response = new Response('err', { status: 400 })
    const details = await formatHttpError(response, {
      url: 'https://example.com',
      requestBody: { key: 'value', nested: { a: 1 } },
    })

    assert.strictEqual(details.requestBody, '{"key":"value","nested":{"a":1}}')
  })
})
