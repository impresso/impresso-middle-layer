import { HookContext } from '@feathersjs/feathers'
import { authenticateAround as authenticate } from '@/hooks/authenticate.js'
import { queryWithCommonParams, utils, validate, validateEach } from '@/hooks/params.js'
import { rateLimit } from '@/hooks/rateLimiter.js'
import { resolveTextReuseClusters } from '@/hooks/resolvers.js'
import { filtersToSolrQuery } from '@/hooks/search.js'
import { ImpressoApplication } from '@/types.js'
import { eachFilterValidator, paramsValidator } from '@/services/search/search.validators.js'
import { getIndexMeta } from '@/services/search-facets/search-facets.class.js'
import { IndexId, OrderByChoices, facetTypes } from '@/services/search-facets/search-facets.schema.js'
import { parseFilters } from '@/util/queryParameters.js'
import { transformResponse } from '@/hooks/transformation.js'
import { transformSearchFacet } from '@/transformers/searchFacet.js'
import { inPublicApi } from '@/hooks/appMode.js'
import { Filter } from 'impresso-jscommons'

interface Params {
  order_by?: { count?: 'asc' | 'desc'; index?: 'asc' | 'desc' }
  group_by?: string
  filters?: Filter[]
}

const getAndFindHooks = (index: IndexId) => [
  validate<Params>({
    order_by: {
      before: (d: any) => (Array.isArray(d) ? d.pop() : d),
      defaultValue: '-count',
      choices: OrderByChoices,
      transform: d => {
        if (typeof d === 'undefined') return
        return utils.translate(Array.isArray(d) ? d[0] : d, {
          '-count': {
            count: 'desc',
          },
          count: {
            count: 'asc',
          },
          '-value': {
            index: 'desc',
          },
          value: {
            index: 'asc',
          },
        })
      },
    },
    group_by: {
      required: false,
      fn: value => {
        if (typeof value === 'string' && value.length > 0) {
          const theFacetTypes = facetTypes[index]
          if (!theFacetTypes.includes(value)) {
            return false
          }
        }
        return true
      },
      message: `Invalid group_by parameter for index ${index}`,
      transform: value => {
        const meta = getIndexMeta(index)
        const facets: Record<string, any> = meta.facets
        return facets[value as string].field
      },
    },
    filters: {
      required: false,
      transform: parseFilters,
    },
  }),
  validateEach('filters', eachFilterValidator),

  filtersToSolrQuery({
    overrideOrderBy: false,
    solrIndexProvider: (_: HookContext) => index.replace('-', '_'),
  } as unknown as any),

  (context: HookContext) => {
    const {
      range_start: rangeStart,
      range_end: rangeEnd,
      range_gap: rangeGap,
      range_include: rangeInclude,
    } = context.params.query
    if (['edge', 'all', 'upper'].includes(rangeInclude)) {
      context.params.sanitized.rangeInclude = rangeInclude
    }
    // if they are all provided, verify that they are integer
    if (!isNaN(rangeStart) && !isNaN(rangeEnd) && !isNaN(rangeGap)) {
      if (
        !Number.isInteger(Number(rangeStart)) ||
        !Number.isInteger(Number(rangeEnd)) ||
        !Number.isInteger(Number(rangeGap))
      ) {
        throw new Error(
          `Invalid range parameters: rangeStart=${rangeStart}, rangeEnd=${rangeEnd}, rangeGap=${rangeGap}`
        )
      }
      context.params.sanitized.rangeGap = context.params.query.rangeGap
      context.params.sanitized.rangeStart = context.params.query.rangeStart
      context.params.sanitized.rangeEnd = context.params.query.rangeEnd
    }
  },
]

export const getHooks = (index: IndexId) => ({
  around: {
    all: [authenticate({ allowUnauthenticated: true }), rateLimit()],
  },
  before: {
    get: [...getAndFindHooks(index), queryWithCommonParams()],
    find: [
      ...getAndFindHooks(index),
      (context: HookContext<ImpressoApplication>) => {
        const value = context.params.query.facets
        const facets = typeof value === 'string' ? [value] : value

        if (Array.isArray(facets) && facets.length > 0) {
          const unknownFacets = facets.filter(d => !facetTypes[index].includes(d))

          if (unknownFacets.length > 0) {
            throw new Error(`Invalid facets for index ${index}: ${unknownFacets}`)
          }
        }
        context.params.sanitized.facets = facets
      },
      queryWithCommonParams(),
    ],
  },

  after: {
    find: [resolveTextReuseClusters()],
    get: [resolveTextReuseClusters(), ...inPublicApi([transformResponse(transformSearchFacet)])],
  },
})
