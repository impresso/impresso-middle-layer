import assert from 'node:assert/strict'
import { ContentItemService } from '@/services/content-items/content-items.class.js'

// The service reads `embeddings` config; leaving it unset exercises the defaults.
const appGet = (key: string) => {
  if (key === 'embeddings') return undefined
  throw new Error(`Unexpected app.get('${key}') in test`)
}

describe('ContentItemService._find', () => {
  it('uses similarity score when an embedding search has no explicit order_by', async () => {
    let requestBody: Record<string, unknown> | undefined
    const solr = {
      namespaces: { Search: 'search' },
      select: async (_namespace: string, request: { body: Record<string, unknown> }) => {
        requestBody = request.body
        return { response: { docs: [], start: 0, numFound: 0 } }
      },
    }
    const service = Object.create(ContentItemService.prototype) as any
    service.app = { service: () => solr, get: appGet }
    service._findPages = async () => ({})
    service.getCollections = async () => ({})
    service.getCachedResolvers = () => ({ topic: async () => undefined })
    service.getContentItemMetadataResolvers = () => ({})

    await service._find({
      originalQuery: { filters: [{ type: 'embedding', q: 'gte-768:AAAA:5' }] },
      query: {
        filters: [{ type: 'embedding', q: 'gte-768:AAAA:5' }],
        include_embeddings: true,
        limit: 5,
        offset: 0,
        // This is the normal, hook-injected default rather than a user choice.
        order_by: 'ocrqa_f desc',
      },
    })

    assert.equal(requestBody?.sort, 'score desc, id asc')
    assert.deepEqual(requestBody?.params, { hl: false })
  })

  it('keeps an explicit order_by for an embedding search', async () => {
    let requestBody: Record<string, unknown> | undefined
    const solr = {
      namespaces: { Search: 'search' },
      select: async (_namespace: string, request: { body: Record<string, unknown> }) => {
        requestBody = request.body
        return { response: { docs: [], start: 0, numFound: 0 } }
      },
    }
    const service = Object.create(ContentItemService.prototype) as any
    service.app = { service: () => solr, get: appGet }
    service._findPages = async () => ({})
    service.getCollections = async () => ({})
    service.getCachedResolvers = () => ({ topic: async () => undefined })
    service.getContentItemMetadataResolvers = () => ({})

    await service._find({
      originalQuery: { order_by: '-ocrQuality', filters: [{ type: 'embedding', q: 'gte-768:AAAA:5' }] },
      query: {
        filters: [{ type: 'embedding', q: 'gte-768:AAAA:5' }],
        include_embeddings: true,
        limit: 5,
        offset: 0,
        order_by: 'ocrqa_f desc',
      },
    })

    assert.equal(requestBody?.sort, 'ocrqa_f desc')
  })
})
