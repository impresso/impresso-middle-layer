import { strict as assert } from 'assert'
import type { Filter } from 'impresso-jscommons'
import type { PartnerInstitutionsDirectory } from '@/internalServices/partnerInstitutionsDirectory.js'
import { setupTestApp, withCachedResolverServices, withConfig, withDatabase } from '../../../helpers/app.js'
import { Fronde, JDG } from '../../../mockData/mediaSources.js'
import { FiltersItems } from '@/services/filters-items/filters-items.class.js'
import { mediaSourceToNewspaper } from '@/services/newspapers/newspapers.class.js'
import { type ISpecialMembershipAccessAttributes } from '@/models/special-membership-access.model.js'

const partnerDirectory = [
  {
    partner_institution_id: 'partner-english',
    partner_institution_names: [
      { lang: 'fr', name: 'Partenaire français' },
      { lang: 'en', name: 'English Partner' },
    ],
    partner_bitmap_index: 1,
  },
  {
    partner_institution_id: 'partner-first-name',
    partner_institution_names: [{ lang: 'de', name: 'Erster Partner' }],
    partner_bitmap_index: 2,
  },
] satisfies PartnerInstitutionsDirectory

describe('FiltersItems', () => {
  let testApp: ReturnType<typeof setupTestApp>
  let service: FiltersItems

  before(() => {
    testApp = setupTestApp(withDatabase(), ctx => {
      ctx.serviceHandlers['media-sources'] = () => ({
        getMediaSource: async (id: string) => [Fronde, JDG].find(source => source.id === id),
      })

      ctx.serviceHandlers['collections'] = () => ({
        getInternal: async () => {
          throw new Error('collections.getInternal should not be called in FiltersItems newspaper tests')
        },
      })

      ctx.serviceHandlers['special-membership-plans'] = () => ({
        getLookup: async () => {
          return {
            '1': { id: 1, title: 'Access 1', bitmapPosition: 1 } as ISpecialMembershipAccessAttributes,
            '2': { id: 2, title: 'Access 2', bitmapPosition: 2 } as ISpecialMembershipAccessAttributes,
          }
        },
      })
    })

    service = new FiltersItems(testApp.app)
  })

  after(async () => {
    await testApp.teardown()
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

  it('returns extracted special membership access items vi permissionExplore', async () => {
    const filters: Filter[] = [
      {
        type: 'permissionExplore',
        context: 'include',
        q: ['1', '2'],
      },
    ]
    const result = await service.find({ filters })

    assert.strictEqual(result.filtersWithItems.length, 1)
    assert.strictEqual(result.filtersWithItems[0].items.length, 2)
    assert.strictEqual(result.filtersWithItems[0].items[0].id, 1)
    assert.strictEqual(result.filtersWithItems[0].items[1].id, 2)
  })

  it('returns resolved partner items for a partner filter', async () => {
    const partnerTestApp = setupTestApp(
      withCachedResolverServices(),
      withConfig('partnerInstitutionsDirectory', partnerDirectory)
    )
    const partnerService = new FiltersItems(partnerTestApp.app)
    const filters: Filter[] = [
      {
        type: 'partner',
        context: 'include',
        q: 'partner-english',
      } as Filter,
    ]

    try {
      const result = await partnerService.find({ filters })

      assert.deepStrictEqual(result.filtersWithItems, [
        {
          filter: filters[0],
          items: [{ id: 'partner-english', title: 'English Partner' }],
        },
      ])
    } finally {
      await partnerTestApp.teardown()
    }
  })
})
