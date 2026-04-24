import { strict as assert } from 'assert'
import type { Filter } from 'impresso-jscommons'
import { protobuf } from 'impresso-jscommons'
import filtersItemsHooks from '@/services/filters-items/filters-items.hooks.js'

describe('FiltersItems hooks', () => {
  it('deserializes serialized filters into params.filters on find', () => {
    const filters: Filter[] = [{ type: 'newspaper', q: 'GDL' } as Filter]
    const serializedFilters: string = protobuf.searchQuery.serialize({ filters })

    const context = {
      params: {
        query: {
          filters: serializedFilters,
        },
      },
    } as any

    const deserializeHook = filtersItemsHooks.before.find[0]
    deserializeHook(context)

    assert.deepStrictEqual(context.params.filters, filters)
  })
  it('checks a complex string filter', () => {
    const serializedFilters: string = 'CgQIARgCCgsYFCoEMC44NSoBMQoOCAEYFSoCMTAqBDg5ODQKDggBEAIYCSoGRnJvbmRl'
    const context = {
      params: {
        query: {
          filters: serializedFilters,
        },
      },
    } as any

    const deserializeHook = filtersItemsHooks.before.find[0]
    deserializeHook(context)
    assert.deepStrictEqual(context.params.filters, [
      { type: 'hasTextContents', context: 'include' },
      { type: 'ocrQuality', q: ['0.85', '1'] },
      { type: 'contentLength', context: 'include', q: ['10', '8984'] },
      { type: 'newspaper', context: 'include', op: 'OR', q: 'Fronde' },
    ])
  })
})
