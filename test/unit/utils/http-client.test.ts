import { strict as assert } from 'assert'
import { XResponse } from '@/utils/http/client/node.js'

async function* bodyFrom(text: string) {
  yield Buffer.from(text)
}

describe('node fetch client', () => {
  describe('XResponse', () => {
    it('exposes response headers from undici response data', () => {
      const response = new XResponse({
        statusCode: 200,
        headers: {
          'content-type': 'image/jpeg',
          'cache-control': ['public', 'max-age=3600'],
        },
        body: bodyFrom('image bytes'),
      } as any)

      assert.strictEqual(response.headers.get('content-type'), 'image/jpeg')
      assert.strictEqual(response.headers.get('cache-control'), 'public, max-age=3600')
    })
  })
})
