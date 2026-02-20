import assert from 'node:assert'
import swagger from 'feathers-swagger'
import { feathers, getServiceOptions } from '@feathersjs/feathers'
import express, { rest } from '@feathersjs/express'
import csvExports from '@/services/csv-exports/csv-exports.service.js'
import { WellKnownKeys } from '@/cache.js'

const mockMediaSources = [
  {
    uid: 'ZULU',
    type: 'newspaper',
    name: 'Zulu Gazette',
    languageCodes: ['en'],
    totals: { articles: 1, issues: 1, pages: 1 },
  },
  {
    uid: 'ALPHA',
    type: 'newspaper',
    name: 'Alpha Daily',
    languageCodes: ['en'],
    totals: { articles: 1, issues: 1, pages: 1 },
  },
]

const createMockResponse = (onDone: (res: any) => void) => {
  let done = false

  const res: any = {
    statusCode: 200,
    headers: {},
    body: undefined,
    hook: undefined,
    data: undefined,
    set(fieldOrHeaders: string | Record<string, unknown>, value?: unknown) {
      if (typeof fieldOrHeaders === 'string') {
        this.headers[fieldOrHeaders.toLowerCase()] = String(value)
      } else {
        Object.entries(fieldOrHeaders).forEach(([header, headerValue]) => {
          this.headers[header.toLowerCase()] = String(headerValue)
        })
      }
      return this
    },
    send(payload: unknown) {
      this.body = String(payload)
      if (!done) {
        done = true
        onDone(this)
      }
      return this
    },
    json(payload: unknown) {
      this.body = JSON.stringify(payload)
      if (!done) {
        done = true
        onDone(this)
      }
      return this
    },
    format(formatters: Record<string, () => void>) {
      if (formatters['application/json'] != null) {
        formatters['application/json']()
      }
    },
  }

  return {
    res,
    finish: () => {
      if (!done) {
        done = true
        onDone(res)
      }
    },
  }
}

const invokeGetRoute = async (app: any, path: string): Promise<any> => {
  const lookup = app.lookup(path)
  if (lookup == null) {
    return {
      statusCode: 404,
      headers: {},
      body: '',
    }
  }

  const { express: expressOptions } = getServiceOptions(lookup.service)
  if (expressOptions?.composed == null) throw new Error(`No composed express middleware configured for ${path}`)
  const composed = expressOptions.composed

  return await new Promise((resolve, reject) => {
    const { res, finish } = createMockResponse(resolve)

    const req: any = {
      method: 'GET',
      url: path,
      originalUrl: path,
      path,
      query: {},
      headers: {},
      body: undefined,
      feathers: {},
      lookup,
    }

    composed(req, res, (error?: any) => {
      if (error != null) {
        reject(error)
        return
      }
      finish()
    })
  })
}

const invokeCsvFormatter = async (app: any, path: string, data: string): Promise<any> => {
  const service = app.service(path)
  const { express: expressOptions } = getServiceOptions(service)
  if (expressOptions == null) throw new Error(`No express options configured for ${path}`)
  const formatter = expressOptions.after?.[0]
  if (formatter == null) throw new Error(`No express.after formatter configured for ${path}`)

  return await new Promise((resolve, reject) => {
    const { res, finish } = createMockResponse(resolve)
    res.data = data
    const req: any = { method: 'GET', path, headers: {} }

    formatter(req, res, (error?: any) => {
      if (error != null) {
        reject(error)
        return
      }
      finish()
    })
  })
}

describe('csv-exports service (public API)', () => {
  let app: any

  before(() => {
    const feathersExpress = express as any
    app = feathersExpress(feathers())

    app.set('isPublicApi', true)
    app.set('cacheManager', {
      get: async (key: string) => {
        if (key === WellKnownKeys.MediaSources) return JSON.stringify(mockMediaSources)
        return null
      },
    })

    app.configure(rest())
    app.configure(
      swagger({
        openApiVersion: 3,
        specs: {
          info: { title: 'CSV Exports Test API', version: '1.0.0' },
          components: {
            schemas: {},
            securitySchemes: {
              BearerAuth: {
                type: 'http',
                scheme: 'bearer',
              },
            },
          },
          security: [{ BearerAuth: [] }],
        },
      })
    )
    app.configure(csvExports)
  })

  it('serves data providers CSV without authentication', async () => {
    const response = await invokeGetRoute(app, '/csv-exports/data-providers.csv')

    assert.strictEqual(response.statusCode, 200)

    const lines = String(response.body)
      .trim()
      .split(/\r?\n/)

    assert.strictEqual(lines[0], 'id,label')
    assert.ok(lines.length > 1)
  })

  it('serves data sources CSV ordered by media source name', async () => {
    const response = await invokeGetRoute(app, '/csv-exports/data-sources.csv')

    assert.strictEqual(response.statusCode, 200)

    const lines = String(response.body)
      .trim()
      .split(/\r?\n/)

    assert.deepStrictEqual(lines, ['id,label', 'ALPHA,Alpha Daily', 'ZULU,Zulu Gazette'])
  })

  it('returns 404 for unknown CSV endpoint under /csv-exports', async () => {
    const response = await invokeGetRoute(app, '/csv-exports/unknown.csv')

    assert.strictEqual(response.statusCode, 404)
  })

  it('serves static content item types CSV without authentication', async () => {
    const response = await invokeGetRoute(app, '/csv-exports/content-item-types.csv')

    assert.strictEqual(response.statusCode, 200)

    const lines = String(response.body)
      .trim()
      .split(/\r?\n/)

    assert.strictEqual(lines[0], 'id,label')
    assert.ok(lines.includes('ad,advertisement'))
    assert.ok(lines.includes('no-type,No type provided'))
  })

  it('formats CSV responses via express.after with text/csv content type', async () => {
    const providersFormatted = await invokeCsvFormatter(app, 'csv-exports/data-providers.csv', 'id,label\nA,Alpha\n')
    const sourcesFormatted = await invokeCsvFormatter(app, 'csv-exports/data-sources.csv', 'id,label\nB,Beta\n')
    const contentTypesFormatted = await invokeCsvFormatter(
      app,
      'csv-exports/content-item-types.csv',
      'id,label\nad,advertisement\n'
    )

    assert.strictEqual(providersFormatted.headers['content-type'], 'text/csv; charset=utf-8')
    assert.strictEqual(sourcesFormatted.headers['content-type'], 'text/csv; charset=utf-8')
    assert.strictEqual(contentTypesFormatted.headers['content-type'], 'text/csv; charset=utf-8')
    assert.strictEqual(providersFormatted.body, 'id,label\nA,Alpha\n')
    assert.strictEqual(sourcesFormatted.body, 'id,label\nB,Beta\n')
    assert.strictEqual(contentTypesFormatted.body, 'id,label\nad,advertisement\n')
  })

  it('documents all CSV endpoints in Swagger with empty security', () => {
    const docs = (app as any).docs

    const providersPath = docs.paths['/csv-exports/data-providers.csv']
    const sourcesPath = docs.paths['/csv-exports/data-sources.csv']
    const contentTypesPath = docs.paths['/csv-exports/content-item-types.csv']

    assert.ok(providersPath)
    assert.ok(sourcesPath)
    assert.ok(contentTypesPath)

    assert.deepStrictEqual(providersPath.get.security, [])
    assert.deepStrictEqual(sourcesPath.get.security, [])
    assert.deepStrictEqual(contentTypesPath.get.security, [])

    assert.strictEqual(providersPath.get.responses['200'].content['text/csv'].schema.type, 'string')
    assert.strictEqual(sourcesPath.get.responses['200'].content['text/csv'].schema.type, 'string')
    assert.strictEqual(contentTypesPath.get.responses['200'].content['text/csv'].schema.type, 'string')
  })
})
