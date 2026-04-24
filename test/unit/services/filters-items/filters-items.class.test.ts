import { strict as assert } from 'assert'
import type { Filter } from 'impresso-jscommons'
import type { CeleryCall, RedisSetExCall, TestDatabase } from '../../../helpers/database.js'
import { setupTestDatabaseRedisCelery, teardownTestDatabase } from '../../../helpers/database.js'
import { Fronde, JDG } from '../../../mockData/mediaSources.js'
import { FiltersItems } from '@/services/filters-items/filters-items.class.js'
import { mediaSourceToNewspaper } from '@/services/newspapers/newspapers.class.js'

describe('FiltersItems', () => {
  let db: TestDatabase
  let service: FiltersItems
  const trackers = { celeryCalls: [] as CeleryCall[], redisCalls: {} as Record<string, RedisSetExCall> }

  before(() => {
    db = setupTestDatabaseRedisCelery(trackers.celeryCalls, trackers.redisCalls)

    const originalService = (db.app as any).service.bind(db.app)
    ;(db.app as any).service = (name: string) => {
      if (name === 'media-sources') {
        return {
          getLookup: async () => {
            return [Fronde, JDG].reduce((lookup, mediaSource) => ({ ...lookup, [mediaSource.id]: mediaSource }), {})
          },
        }
      }

      if (name === 'collections') {
        return {
          getInternal: async () => {
            throw new Error('collections.getInternal should not be called in FiltersItems newspaper tests')
          },
        }
      }

      return originalService(name)
    }

    service = new FiltersItems(db.app)
  })

  after(async () => {
    await teardownTestDatabase(db)
  })

  it('returns extracted newspaper items for a newspaper filter? Note that newspaper is deprecated, but we should keep it as alias', async () => {
    const filters: Filter[] = [
      {
        type: 'newspaper',
        context: 'include',
        op: 'OR',
        q: [Fronde.id, JDG.id], // Using IDs directly to match the lookup keys
      } as Filter,
    ]
    const result = await service.find({ filters })

    assert.strictEqual(result.filtersWithItems.length, 1)
    assert.deepStrictEqual(result.filtersWithItems[0].filter, filters[0])
    // We wrap mocked MediaSource objects with mediaSourceToNewspaper in assertions because FiltersItems still resolves the legacy newspaper filter through the media-source lookup and then normalizes each hit to Newspaper shape (this alias is deprecated and will switch to mediaSource in upcoming releases).
    assert.deepStrictEqual(result.filtersWithItems[0].items[0], { ...mediaSourceToNewspaper(Fronde) })
    assert.deepStrictEqual(result.filtersWithItems[0].items[1], { ...mediaSourceToNewspaper(JDG) })
  })

  it('returns extracted newspaper, ocr quality and content length', async () => {
    const filters: Filter[] = [
      {
        type: 'hasTextContents',
        context: 'include',
        q: '',
      },
      {
        type: 'ocrQuality',
        q: ['0.85', '1'],
      },
      {
        type: 'contentLength',
        context: 'include',
        q: ['10', '8984'],
      },
    ]

    const result = await service.find({ filters })

    assert.strictEqual(result.filtersWithItems.length, 3)
    assert.deepStrictEqual(result.filtersWithItems[0].items, [{ id: '' }])
    assert.deepStrictEqual(result.filtersWithItems[1].items, [{ start: 0.85, end: 1 }])
    assert.deepStrictEqual(result.filtersWithItems[2].items, [{ start: 10, end: 8984 }])
  })
})
