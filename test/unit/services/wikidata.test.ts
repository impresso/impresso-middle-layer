import assert from 'assert'
import sinon from 'sinon'
import { resolveWithCache, WikidataCacheKeyPrefix, ICache } from '../../../src/services/wikidata.ts'

/**
 * In-memory cache implementation for testing
 */
class MemoryCache implements ICache {
  private store: Map<string, string> = new Map()

  async get(key: string): Promise<string | null> {
    return this.store.get(key) ?? null
  }

  async set(key: string, value: string): Promise<void> {
    this.store.set(key, value)
  }

  clear(): void {
    this.store.clear()
  }
}

/**
 * Mock fetch client for testing
 */
class MockFetchClient {
  fetchStub: sinon.SinonStub

  constructor() {
    this.fetchStub = sinon.stub(this, 'fetch')
  }

  async fetch(url: string, init?: RequestInit, options?: any): Promise<Response> {
    return this.fetchStub(url, init, options)
  }

  restore(): void {
    this.fetchStub.restore()
  }
}

describe('wikidata service', () => {
  describe('resolveWithCache', () => {
    let mockClient: MockFetchClient

    beforeEach(() => {
      mockClient = new MockFetchClient()
    })

    afterEach(() => {
      mockClient.restore()
    })

    it('fetches entities from API when cache is empty', async () => {
      const cache = new MemoryCache()
      const mockApiResponse = {
        entities: {
          Q5: {
            type: 'item',
            id: 'Q5',
            labels: { en: { language: 'en', value: 'human' } },
            descriptions: { en: { language: 'en', value: 'common name of Homo sapiens' } },
            claims: {},
          },
        },
      }

      mockClient.fetchStub.resolves({
        json: async () => mockApiResponse,
      } as Response)

      const result = await resolveWithCache(['Q5'], ['en'], cache, mockClient as any)

      assert.strictEqual(Object.keys(result).length, 1)
      assert.ok(result['Q5'])
      assert.strictEqual(mockClient.fetchStub.callCount, 1)
    })

    it('returns entities from cache without API call', async () => {
      const cache = new MemoryCache()
      const cachedEntity = {
        type: 'item',
        id: 'Q5',
        labels: { en: { language: 'en', value: 'human' } },
        descriptions: { en: { language: 'en', value: 'common name of Homo sapiens' } },
        claims: {},
      }

      // Pre-populate cache
      await cache.set(`${WikidataCacheKeyPrefix}Q5`, JSON.stringify(cachedEntity))

      const result = await resolveWithCache(['Q5'], ['en'], cache, mockClient as any)

      assert.strictEqual(Object.keys(result).length, 1)
      assert.deepStrictEqual(result['Q5'], cachedEntity)
      assert.strictEqual(mockClient.fetchStub.callCount, 0, 'API should not be called when entity is cached')
    })

    it('fetches missing entities and returns both cached and fetched', async () => {
      const cache = new MemoryCache()
      const cachedEntity = {
        type: 'item',
        id: 'Q5',
        labels: { en: { language: 'en', value: 'human' } },
        descriptions: { en: { language: 'en', value: 'common name of Homo sapiens' } },
        claims: {},
      }

      const fetchedEntity = {
        type: 'item',
        id: 'Q6',
        labels: { en: { language: 'en', value: 'woman' } },
        descriptions: { en: { language: 'en', value: 'adult female human' } },
        claims: {},
      }

      // Pre-populate cache with Q5
      await cache.set(`${WikidataCacheKeyPrefix}Q5`, JSON.stringify(cachedEntity))

      const mockApiResponse = {
        entities: {
          Q6: fetchedEntity,
        },
      }

      mockClient.fetchStub.resolves({
        json: async () => mockApiResponse,
      } as Response)

      const result = await resolveWithCache(['Q5', 'Q6'], ['en'], cache, mockClient as any)

      assert.strictEqual(Object.keys(result).length, 2)
      assert.deepStrictEqual(result['Q5'], cachedEntity, 'Cached entity should be returned')
      assert.deepStrictEqual(result['Q6'], fetchedEntity, 'Fetched entity should be returned')
      assert.strictEqual(mockClient.fetchStub.callCount, 1)
    })

    it('stores fetched entities in cache', async () => {
      const cache = new MemoryCache()
      const mockApiResponse = {
        entities: {
          Q5: {
            type: 'item',
            id: 'Q5',
            labels: { en: { language: 'en', value: 'human' } },
            descriptions: { en: { language: 'en', value: 'common name of Homo sapiens' } },
            claims: {},
          },
        },
      }

      mockClient.fetchStub.resolves({
        json: async () => mockApiResponse,
      } as Response)

      await resolveWithCache(['Q5'], ['en'], cache, mockClient as any)

      // Verify entity is stored in cache
      const cachedValue = await cache.get(`${WikidataCacheKeyPrefix}Q5`)
      assert.ok(cachedValue)
      const cachedEntity = JSON.parse(cachedValue!)
      assert.strictEqual(cachedEntity.id, 'Q5')
    })

    it('handles multiple entity IDs without cache', async () => {
      const cache = new MemoryCache()
      const mockApiResponse = {
        entities: {
          Q5: {
            type: 'item',
            id: 'Q5',
            labels: { en: { language: 'en', value: 'human' } },
            descriptions: {},
            claims: {},
          },
          Q6: {
            type: 'item',
            id: 'Q6',
            labels: { en: { language: 'en', value: 'woman' } },
            descriptions: {},
            claims: {},
          },
        },
      }

      mockClient.fetchStub.resolves({
        json: async () => mockApiResponse,
      } as Response)

      const result = await resolveWithCache(['Q5', 'Q6'], ['en'], cache, mockClient as any)

      assert.strictEqual(Object.keys(result).length, 2)
      assert.ok(result['Q5'])
      assert.ok(result['Q6'])
    })

    it('works without cache parameter', async () => {
      const mockApiResponse = {
        entities: {
          Q5: {
            type: 'item',
            id: 'Q5',
            labels: { en: { language: 'en', value: 'human' } },
            descriptions: {},
            claims: {},
          },
        },
      }

      mockClient.fetchStub.resolves({
        json: async () => mockApiResponse,
      } as Response)

      const result = await resolveWithCache(['Q5'], ['en'], undefined, mockClient as any)

      assert.strictEqual(Object.keys(result).length, 1)
      assert.ok(result['Q5'])
      assert.strictEqual(mockClient.fetchStub.callCount, 1)
    })

    it('uses default languages when not provided', async () => {
      const cache = new MemoryCache()
      const mockApiResponse = {
        entities: {
          Q5: {
            type: 'item',
            id: 'Q5',
            labels: { en: { language: 'en', value: 'human' } },
            descriptions: {},
            claims: {},
          },
        },
      }

      mockClient.fetchStub.resolves({
        json: async () => mockApiResponse,
      } as Response)

      const result = await resolveWithCache(['Q5'], undefined, cache, mockClient as any)

      assert.strictEqual(Object.keys(result).length, 1)
      assert.ok(result['Q5'])
    })

    it('handles empty entity list', async () => {
      const cache = new MemoryCache()

      const result = await resolveWithCache([], ['en'], cache, mockClient as any)

      assert.strictEqual(Object.keys(result).length, 0)
      assert.strictEqual(mockClient.fetchStub.callCount, 0, 'API should not be called for empty list')
    })

    it('caches each entity individually with correct key pattern', async () => {
      const cache = new MemoryCache()
      const mockApiResponse = {
        entities: {
          Q5: {
            type: 'item',
            id: 'Q5',
            labels: { en: { language: 'en', value: 'human' } },
            descriptions: {},
            claims: {},
          },
          Q6: {
            type: 'item',
            id: 'Q6',
            labels: { en: { language: 'en', value: 'woman' } },
            descriptions: {},
            claims: {},
          },
        },
      }

      mockClient.fetchStub.resolves({
        json: async () => mockApiResponse,
      } as Response)

      await resolveWithCache(['Q5', 'Q6'], ['en'], cache, mockClient as any)

      // Verify both entities are cached with correct keys
      const cached1 = await cache.get(`${WikidataCacheKeyPrefix}Q5`)
      const cached2 = await cache.get(`${WikidataCacheKeyPrefix}Q6`)
      assert.ok(cached1)
      assert.ok(cached2)
      assert.strictEqual(JSON.parse(cached1!).id, 'Q5')
      assert.strictEqual(JSON.parse(cached2!).id, 'Q6')
    })
  })
})
