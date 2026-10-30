import { strict as assert } from 'assert'
import { createServer, Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { FetchClient, XResponse } from '@/utils/http/client/node.js'

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

    it('returns the full body to concurrent text() callers', async () => {
      async function* chunkedBody() {
        yield Buffer.from('{"error":')
        yield Buffer.from('"boom"}')
      }
      const response = new XResponse({
        statusCode: 500,
        headers: {},
        body: chunkedBody(),
      } as any)

      const [first, second] = await Promise.all([response.text(), response.text()])

      assert.strictEqual(first, '{"error":"boom"}')
      assert.strictEqual(second, '{"error":"boom"}')
    })
  })

  describe('FetchClient', () => {
    let server: Server
    let baseUrl: string
    let connectionsCount: number
    let statusCodes: number[]

    beforeEach(async () => {
      connectionsCount = 0
      statusCodes = []
      server = createServer((req, res) => {
        res.statusCode = statusCodes.shift() ?? 200
        res.end(`{"path":"${req.url}"}`)
      })
      server.on('connection', () => connectionsCount++)
      await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
      baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
    })

    afterEach(async () => {
      server.closeAllConnections()
      await new Promise(resolve => server.close(resolve))
    })

    it('reuses connections across requests', async () => {
      const client = new FetchClient({})
      try {
        const paths = ['/a', '/b', '/c', '/d', '/e', '/f']
        for (const path of paths) {
          const response = await client.fetch(`${baseUrl}${path}`, { method: 'POST', body: '{}' })
          assert.deepStrictEqual(await response.json(), { path })
        }
        // undici may rotate between a couple of warm sockets, but must not open one per request
        assert.ok(connectionsCount <= 2, `expected at most 2 connections, got ${connectionsCount}`)
      } finally {
        await client.close()
      }
    })

    it('reuses connections when retrying on status codes', async () => {
      statusCodes = [503, 503]
      const client = new FetchClient({})
      try {
        const response = await client.fetch(
          `${baseUrl}/retry`,
          { method: 'POST', body: '{}' },
          { retryOptions: { maxRetries: 2, minTimeout: 1, maxTimeout: 1, statusCodes: [503], methods: ['POST'] } }
        )
        assert.strictEqual(response.status, 200)
        assert.ok(connectionsCount <= 2, `expected at most 2 connections, got ${connectionsCount}`)
      } finally {
        await client.close()
      }
    })

    it('serves parallel requests', async () => {
      const client = new FetchClient({})
      try {
        const paths = ['/1', '/2', '/3', '/4', '/5']
        const responses = await Promise.all(paths.map(path => client.fetch(`${baseUrl}${path}`)))
        const bodies = await Promise.all(responses.map(response => response.json()))
        assert.deepStrictEqual(
          bodies,
          paths.map(path => ({ path }))
        )
      } finally {
        await client.close()
      }
    })
  })
})
