import { Params } from '@feathersjs/feathers'
import lodash from 'lodash'
import { isNumber, SolrMappings } from '../../data/constants'
import { FindResponse } from '../../models/common'
import type { SearchFacet } from '../../models/generated/schemas'
import type { Filter } from '../../models/generated/shared'
import SearchFacetModel from '../../models/search-facets.model'
import { ImpressoApplication } from '../../types'
import { areCacheableFacets, isCacheableQuery } from '../../util/cache'
import { measureTime } from '../../util/instruments'
import { IndexId } from './search-facets.schema'
import {
  isSolrRangeFacetQuerParams,
  isSolrTermsFacetQuerParams,
  SolrFacetQueryParams,
  SolrRangeFacetQueryParams,
  SolrTermsFacetQueryParams,
} from '../../data/types'
import { SelectQueryParameters, SelectRequestBody, SimpleSolrClient } from '../../internalServices/simpleSolr'
import { SolrNamespace } from '@/solr'

const debug = require('debug')('impresso/services:search-facets')

type FacetMetadata = any

export const getIndexMeta = (indexId: IndexId) => {
  switch (indexId) {
    case 'search':
      return SolrMappings.search
    case 'tr-clusters':
      return SolrMappings['tr_clusters']
    case 'tr-passages':
      return SolrMappings['tr_passages']
    default:
      throw new Error(`Unknown index: ${indexId}`)
  }
}

interface IRangeFacetMetadata {
  min?: number
  max?: number
  gap?: number
}

const getRangeFacetMetadata = (facet: FacetMetadata): IRangeFacetMetadata => {
  if (facet.type !== 'range') return {}
  return {
    min: facet.start,
    max: facet.end,
    gap: facet.gap,
  }
}

interface GetQuery {
  offset?: number
  limit?: number
  order_by: SolrTermsFacetQueryParams['sort']
}

interface FindQuery extends GetQuery {
  facets: string[]
}

interface SanitizedGetParams {
  rangeStart?: number
  rangeEnd?: number
  rangeGap?: number
  rangeInclude?: any
  filters?: Filter[]
  group_by?: string
  sq?: string
  sv?: string[]
  facets?: string[]
}

type FacetsQueryPart = Partial<
  Pick<SolrTermsFacetQueryParams, 'offset' | 'limit' | 'sort'> &
    Pick<SolrRangeFacetQueryParams, 'start' | 'end' | 'gap' | 'include'>
>

interface ISolrBucket {
  val?: string | number
  count?: number
}

interface ISolrCount {
  count: number
}

interface ISolrResponseTermsFacetDetails {
  numBuckets?: number
  buckets: ISolrBucket[]
}

interface ISolrResponseRangeFacetDetails {
  buckets: ISolrBucket[]
  before?: ISolrCount
  after?: ISolrCount
  between?: ISolrCount
}

type ISolrResponseFacetDetails = ISolrResponseTermsFacetDetails | ISolrResponseRangeFacetDetails

interface ServiceOptions {
  app: ImpressoApplication
  name: string
  index: IndexId
}

export class Service {
  app: ImpressoApplication
  name: string
  index: IndexId
  solr: SimpleSolrClient

  constructor({ app, name, index }: ServiceOptions) {
    this.app = app
    this.name = name
    this.index = index
    this.solr = app.service('simpleSolrClient')
  }

  async get(type: string, params: Params<GetQuery>): Promise<SearchFacet> {
    // const { index } = params.query
    // const types = getFacetTypes(type, this.index)

    // init with limit and offset
    const facetsq: FacetsQueryPart = {
      offset: params.query?.offset,
      limit: params.query?.limit,
      sort: params.query?.order_by,
    }

    const sanitizedParams = (params as any).sanitized as SanitizedGetParams

    const result = await this._getFacetsFromSolr(
      [type],
      this.index,
      facetsq,
      params.authenticated ?? false,
      (params as any)?.user?.uid,
      sanitizedParams
    )

    return result[0]
  }

  async find(params: Params<FindQuery>): Promise<FindResponse<SearchFacet>> {
    const facetsq: FacetsQueryPart = {
      offset: params.query?.offset,
      limit: params.query?.limit,
      sort: params.query?.order_by,
    }

    const sanitizedParams = (params as any).sanitized as SanitizedGetParams

    const result = await this._getFacetsFromSolr(
      sanitizedParams.facets ?? [],
      this.index,
      facetsq,
      params.authenticated ?? false,
      (params as any)?.user?.uid,
      sanitizedParams
    )

    return {
      data: result,
      limit: facetsq.limit ?? 0,
      offset: facetsq.offset ?? 0,
      total: 0,
      info: {},
    }
  }

  async _getFacetsFromSolr(
    types: string[],
    index: IndexId,
    facetsQueryPart: FacetsQueryPart,
    isAuthenticated: boolean,
    userId: string,
    sanitizedParams: SanitizedGetParams
  ): Promise<SearchFacet[]> {
    if (types.length === 0) return []

    const facetsq = { ...facetsQueryPart }

    if (sanitizedParams.rangeStart) {
      facetsq.start = sanitizedParams.rangeStart
    }
    if (sanitizedParams.rangeEnd) {
      facetsq.end = sanitizedParams.rangeEnd
    }
    if (sanitizedParams.rangeGap) {
      facetsq.gap = sanitizedParams.rangeGap
    }
    if (sanitizedParams.rangeInclude) {
      facetsq.include = sanitizedParams.rangeInclude
    }

    const canBeCached = areCacheableFacets(types) && isCacheableQuery(sanitizedParams.filters ?? [])

    const indexFacets = getIndexMeta(index).facets

    const facets = types.reduce(
      (acc, facetType) => {
        const facetParams = indexFacets[facetType]
        if (isSolrTermsFacetQuerParams(facetParams)) {
          const combinedParams: SolrTermsFacetQueryParams = {
            ...facetParams,
            ...lodash.pick(facetsq, 'limit', 'offset', 'sort'),
          }
          if (facetType === 'collection') {
            combinedParams.prefix = isAuthenticated ? userId : '-'
          }
          return { ...acc, [facetType]: combinedParams }
        } else if (isSolrRangeFacetQuerParams(facetParams)) {
          const combinedParams: SolrRangeFacetQueryParams = {
            ...facetParams,
            ...facetsq,
            ...lodash.pick(facetsq, 'start', 'end', 'gap', 'include'),
            other: 'all',
          }
          return { ...acc, [facetType]: combinedParams }
        }
        return acc
      },
      {} satisfies Record<string, SolrFacetQueryParams>
    )

    debug(
      `[get] "${types.join(', ')}" (${canBeCached ? 'cached' : 'not cached'}):`,
      `index: ${index}`,
      'facets:',
      facets,
      'group_by',
      sanitizedParams.group_by || 'none'
    )
    const query: SelectRequestBody = {
      query: sanitizedParams.sq ?? '*:*',
      facet: facets,
      offset: 0,
      limit: 0,
      params: {
        hl: false,
      },
    }
    const vars = sanitizedParams.sv as SelectQueryParameters

    if (sanitizedParams.group_by) {
      query.filter = `{!collapse field=${sanitizedParams.group_by}}`
    }
    const result = await measureTime(
      () => this.solr.select(index.replace('-', '_') as SolrNamespace, { body: query, params: vars }), //! canBeCached }),
      'search-facets.get.solr.facets'
    )
    const resultFacets = result.facets as Record<string, ISolrResponseFacetDetails>

    return types.map(facetType => {
      const facetParams = indexFacets[facetType]

      if (isSolrTermsFacetQuerParams(facetParams)) {
        const facetDetails: ISolrResponseTermsFacetDetails | undefined = resultFacets[facetType]

        return new SearchFacetModel({
          type: facetType,
          buckets: (facetDetails?.buckets ?? []) as any,
          numBuckets: facetDetails?.numBuckets ?? 0,
        })
      } else if (isSolrRangeFacetQuerParams(facetParams)) {
        const facetDetails: ISolrResponseRangeFacetDetails | undefined = resultFacets[facetType]

        const rangeFacetMetadata = getRangeFacetMetadata(facetParams)
        // check that facetsq params are all defined
        if (facetsQueryPart.start == null || isNumber(facetsQueryPart.start)) {
          rangeFacetMetadata.min = facetsQueryPart.start
        }
        if (facetsQueryPart.end == null || isNumber(facetsQueryPart.end)) {
          rangeFacetMetadata.max = facetsQueryPart.end
        }
        if (facetsQueryPart.gap == null || isNumber(facetsQueryPart.gap)) {
          rangeFacetMetadata.gap = facetsQueryPart.gap
        }

        // range facets are not paginated and not sorted in Solr,
        // we have to do it here

        const limit = facetsq.limit ?? facetDetails?.buckets?.length ?? 0
        const offset = facetsq.offset ?? 0
        const sortedBuckets = getSortedBuckets(facetDetails?.buckets ?? [], facetsq.sort)
        const limitedBuckets = sortedBuckets.slice(offset, offset + limit)

        if (facetsq.limit != null || facetsq.limit != null)
          return new SearchFacetModel({
            type: facetType,
            buckets: limitedBuckets as any,
            numBuckets: facetDetails?.buckets?.length ?? 0,
            min: rangeFacetMetadata.min as any,
            max: rangeFacetMetadata.max as any,
            gap: rangeFacetMetadata.gap as any,
          })
      }
      return new SearchFacetModel({
        type: facetType,
      })
    })
  }
}

const getSortedBuckets = (buckets: ISolrBucket[], sort?: SolrTermsFacetQueryParams['sort']): ISolrBucket[] => {
  const sorter = (compareKey: keyof ISolrBucket, order: 'asc' | 'desc') => (a: ISolrBucket, b: ISolrBucket) => {
    const aVal = a[compareKey] ?? 0
    const bVal = b[compareKey] ?? 0

    if (aVal > bVal) return order == 'asc' ? 1 : -1
    else if (aVal < bVal) return order == 'asc' ? -1 : 1
    return 0
  }

  if (sort?.count != null) {
    return buckets.sort(sorter('count', sort.count))
  } else if (sort?.index != null) {
    return buckets.sort(sorter('val', sort.index))
  }

  return buckets
}
