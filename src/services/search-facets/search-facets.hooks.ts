import { HookContext } from '@feathersjs/feathers'
import { authenticateAround as authenticate } from '../../hooks/authenticate'
import { queryWithCommonParams, utils, validate, validateEach } from '../../hooks/params'
import { rateLimit } from '../../hooks/rateLimiter'
import { resolveCollections, resolveTextReuseClusters } from '../../hooks/resolvers'
import { filtersToSolrQuery } from '../../hooks/search'
import { ImpressoApplication } from '../../types'
import { eachFilterValidator, paramsValidator } from '../search/search.validators'
import { getIndexMeta } from './search-facets.class'
import { IndexId, OrderByChoices, facetTypes } from './search-facets.schema'
import { parseFilters } from '../../util/queryParameters'

const getAndFindHooks = (index: IndexId) => [
  validate({
    order_by: {
      before: (d: any) => (Array.isArray(d) ? d.pop() : d),
      defaultValue: '-count',
      choices: OrderByChoices,
      transform: (d: any) =>
        utils.translate(d, {
          '-count': {
            count: 'desc',
          },
          count: {
            count: 'asc',
          },
        }),
    },
    group_by: {
      required: false,
      fn: (value?: string) => {
        if (typeof value === 'string' && value.length > 0) {
          if (!facetTypes[index].includes(value)) {
            return false
          }
        }
        return true
      },
      message: `Invalid group_by parameter for index ${index}`,
      transform(value: string) {
        const meta = getIndexMeta(index)
        const facets: Record<string, any> = meta.facets
        return facets[value].field
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
    find: [resolveCollections(), resolveTextReuseClusters()],
    get: [resolveCollections(), resolveTextReuseClusters()],
  },
})
