import { Params } from '@feathersjs/feathers'
import lodash from 'lodash'
import { isNumber, SolrMappings } from '@/data/constants.js'
import { FindResponse } from '@/models/common.js'
import type { SearchFacet } from '@/models/generated/schemas.js'
import type { Filter } from '@/models/generated/shared.js'
import { SearchFacet as SearchFacetModel } from '@/models/search-facets.model.js'
import { ImpressoApplication } from '@/types.js'
import { areCacheableFacets, isCacheableQuery } from '@/util/cache.js'
import { measureTime } from '@/util/instruments.js'
import { IndexId } from '@/services/search-facets/search-facets.schema.js'
import {
  isSolrRangeFacetQueryParams,
  isSolrTermsFacetQueryParams,
  SolrFacetQueryParams,
  SolrRangeFacetQueryParams,
  SolrTermsFacetQueryParams,
} from '@/data/types.js'
import {
  SelectQueryParameters,
  SelectRequest,
  SelectRequestBody,
  SimpleSolrClient,
} from '@/internalServices/simpleSolr.js'
import { SolrNamespace, SolrNamespaces } from '@/solr.js'

import Debug from 'debug'
import { toPair } from '@/solr/queries/collections.js'
const debug = Debug('impresso/services:search-facets')

type FacetMetadata = any

export const getIndexMeta = (indexId: IndexId) => {
  switch (indexId) {
    case 'search':
      return SolrMappings.search
    case 'tr-clusters':
      return SolrMappings['tr_clusters']
    case 'tr-passages':
      return SolrMappings['tr_passages']
    case 'images':
      return SolrMappings.images
    case 'collection-items':
      return SolrMappings['collection_items']
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
  sfq?: string[] | string
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

const buildFacetsRequest = (
  types: string[],
  index: IndexId,
  facetsQueryPart: FacetsQueryPart,
  sanitizedParams: SanitizedGetParams,
  extraFilters?: string[]
): SelectRequest => {
  if (types.length === 0) throw new Error('No facet types provided')

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
      const facetParams = indexFacets[facetType as keyof typeof indexFacets] as SolrFacetQueryParams
      if (isSolrTermsFacetQueryParams(facetParams)) {
        const combinedParams: SolrTermsFacetQueryParams = {
          ...facetParams,
          ...lodash.pick(facetsq, 'limit', 'offset', 'sort'),
        }
        return { ...acc, [facetType]: combinedParams }
      } else if (isSolrRangeFacetQueryParams(facetParams)) {
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
    filter: sanitizedParams.sfq,
  }
  const vars = sanitizedParams.sv as SelectQueryParameters

  if (sanitizedParams.group_by) {
    const filter = query.filter as string[]
    filter.push(`{!collapse field=${sanitizedParams.group_by}}`)
  }
  if (extraFilters != null) {
    const filter = query.filter as string[]
    filter.push(...extraFilters)
  }

  return { body: query, params: vars }
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

const parseSolrFacet = async (
  facetType: string,
  index: IndexId,
  facetsQueryPart: FacetsQueryPart,
  resultFacets: Record<string, ISolrResponseFacetDetails>,
  app: ImpressoApplication
) => {
  const indexFacets = getIndexMeta(index).facets
  const facetParams = indexFacets[facetType as keyof typeof indexFacets] as SolrFacetQueryParams

  if (isSolrTermsFacetQueryParams(facetParams)) {
    const facetDetails: ISolrResponseTermsFacetDetails | undefined = resultFacets[facetType]

    return await SearchFacetModel.build(
      {
        type: facetType,
        buckets: (facetDetails?.buckets ?? []) as any,
        numBuckets: facetDetails?.numBuckets ?? 0,
      },
      app
    )
  } else if (isSolrRangeFacetQueryParams(facetParams)) {
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

    const limit = facetsQueryPart.limit ?? facetDetails?.buckets?.length ?? 0
    const offset = facetsQueryPart.offset ?? 0
    const sortedBuckets = getSortedBuckets(facetDetails?.buckets ?? [], facetsQueryPart.sort)
    const limitedBuckets = sortedBuckets.slice(offset, offset + limit)

    if (facetsQueryPart.limit != null || facetsQueryPart.limit != null)
      return await SearchFacetModel.build(
        {
          type: facetType,
          buckets: limitedBuckets as any,
          numBuckets: facetDetails?.buckets?.length ?? 0,
          min: rangeFacetMetadata.min as any,
          max: rangeFacetMetadata.max as any,
          gap: rangeFacetMetadata.gap as any,
        },
        app
      )
  }
  return SearchFacetModel.build(
    {
      type: facetType,
      buckets: [],
      numBuckets: 0,
    },
    app
  )
}

const parseSolrFacets = async (
  types: string[],
  index: IndexId,
  facetsQueryPart: FacetsQueryPart,
  resultFacets: Record<string, ISolrResponseFacetDetails>,
  app: ImpressoApplication
): Promise<SearchFacet[]> => {
  const promises = types.map(type => parseSolrFacet(type, index, facetsQueryPart, resultFacets, app))

  return Promise.all(promises)
}

type SolrNamespaceWithContentItemField = Extract<
  SolrNamespace,
  'search' | 'tr_passages' | 'collection_items' | 'images'
>

const hasContentItemField = (namespace: SolrNamespace): namespace is SolrNamespaceWithContentItemField => {
  return ['search', 'tr_passages', 'collection_items', 'images'].includes(namespace)
}

const ContentItemIdFieldInNamespace: Record<SolrNamespaceWithContentItemField, string> = {
  search: 'id',
  tr_passages: 'ci_id_s',
  collection_items: 'ci_id_s',
  images: 'linked_ci_s',
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
      (params as any)?.user?.id,
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
      (params as any)?.user?.id,
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
    const hasCollectionFacet = types.includes('collection')

    const nonCollectionFacetsPromise = this._getStandardFacetsFromSolr(types, index, facetsQueryPart, sanitizedParams)
    const collectionFacetPromise = hasCollectionFacet
      ? this._getCollectionFacetFromSolr(
          index,
          facetsQueryPart,
          sanitizedParams,
          this.app,
          isAuthenticated ? userId : undefined
        )
      : Promise.resolve(null)

    const [facets, collectionFacet] = await Promise.all([nonCollectionFacetsPromise, collectionFacetPromise])
    return collectionFacet ? [...facets, collectionFacet] : facets
  }

  /**
   * All facets that do not require a join.
   */
  async _getStandardFacetsFromSolr(
    types: string[],
    index: IndexId,
    facetsQueryPart: FacetsQueryPart,
    sanitizedParams: SanitizedGetParams
  ): Promise<SearchFacet[]> {
    const actualTypes = types.filter(t => t !== 'collection')
    if (actualTypes.length === 0) return []

    const query = buildFacetsRequest(actualTypes, index, facetsQueryPart, sanitizedParams)

    const result = await measureTime(
      () => this.solr.select(index.replace('-', '_') as SolrNamespace, query),
      'search-facets.get.solr.facets'
    )
    const resultFacets = result.facets as Record<string, ISolrResponseFacetDetails>

    return await parseSolrFacets(types, index, facetsQueryPart, resultFacets, this.app)
  }

  /**
   * Collection is a specific case where getting the facet requires
   * a join between collection_items and the index.
   * This method handles this business logic.
   */
  async _getCollectionFacetFromSolr(
    index: IndexId,
    facetsQueryPart: FacetsQueryPart,
    sanitizedParams: SanitizedGetParams,
    app: ImpressoApplication,
    userId?: string
  ): Promise<SearchFacet> {
    const types = ['collection']
    const collectionIndexId = 'collection-items'

    // we cannot use group_by with join
    const { group_by, sq, ...sanitizedParamsWithoutGroupBy } = sanitizedParams

    const contentItemNamespace = index.replace('-', '_') as SolrNamespace
    if (!hasContentItemField(contentItemNamespace)) {
      throw new Error(`Cannot get collection facet for index ${index}`)
    }

    const contentItemIndex = app
      .get('solrConfiguration')
      ?.namespaces?.find(n => n.namespaceId === contentItemNamespace)?.index

    const contentItemIdField = ContentItemIdFieldInNamespace[contentItemNamespace]

    const isEmpty = (str: string) => str == null || str.trim() === ''
    // original query goes into the join filter which links the actual index with collection_items
    const filtersPart = Array.isArray(sanitizedParams.sfq)
      ? sanitizedParams.sfq?.map(f => `filter(${f})`).join(' AND ')
      : sanitizedParams.sfq != null
        ? `filter(${sanitizedParams.sfq})`
        : '*:*'
    const joinFilter = `{!join from=${contentItemIdField} to=ci_id_s fromIndex=${contentItemIndex} method=crossCollection} ${sanitizedParams.sq}${isEmpty(filtersPart) ? '' : ` AND ${filtersPart}`}`

    const collectionsQuery = userId
      ? `col_id_s:${userId}_* OR vis_s:pub` // user collections + public collections
      : 'vis_s:pub' // public collections only

    const updatedParams = {
      ...sanitizedParamsWithoutGroupBy,
      sq: collectionsQuery,
      sfq: [], // we already applied the original filters in the join
    }

    const query = buildFacetsRequest(types, collectionIndexId, facetsQueryPart, updatedParams, [joinFilter])

    const result = await measureTime(
      () => this.solr.select(SolrNamespaces.CollectionItems, query),
      'search-facets.get.solr.facets'
    )
    const resultFacets = result.facets as Record<string, ISolrResponseFacetDetails>
    const updatedBuckets = resultFacets.collection?.buckets?.map(b => {
      const { collectionId } = toPair(b.val as string)
      return {
        ...b,
        val: collectionId,
      }
    })
    if (resultFacets.collection) {
      resultFacets.collection.buckets = updatedBuckets
    }

    const facets = await parseSolrFacets(types, collectionIndexId, facetsQueryPart, resultFacets, this.app)
    return facets[0]
  }
}
