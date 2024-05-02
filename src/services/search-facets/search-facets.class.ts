import { Params } from '@feathersjs/feathers'
import lodash from 'lodash'
import { CachedSolrClient } from '../../cachedSolr'
import { SolrMappings } from '../../data/constants'
import { FindResponse } from '../../models/common'
import type { Filter, SearchFacet } from '../../models/generated/schemas'
import SearchFacetModel from '../../models/search-facets.model'
import { ImpressoApplication } from '../../types'
import { areCacheableFacets, isCacheableQuery } from '../../util/cache'
import { measureTime } from '../../util/instruments'
import { IndexId } from './search-facets.schema'

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

const getRangeFacetMetadata = (facet: FacetMetadata) => {
  if (facet.type !== 'range') return {}
  return {
    min: facet.start,
    max: facet.end,
    gap: facet.gap,
  }
}

interface GetQuery {
  skip?: number
  limit?: number
  order_by?: string
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
  groupby?: string
  sq?: string
  sv?: string[]
  facets?: string[]
}

interface FacetsQueryPart {
  offset?: number
  limit?: number
  sort?: string
  start?: number
  end?: number
  gap?: number
  include?: any
}

interface ServiceOptions {
  app: ImpressoApplication
  name: string
  index: IndexId
}

export class Service {
  app: ImpressoApplication
  name: string
  index: IndexId
  solr: CachedSolrClient

  constructor({ app, name, index }: ServiceOptions) {
    this.app = app
    this.name = name
    this.index = index
    this.solr = app.service('cachedSolr')
  }

  async get(type: string, params: Params<GetQuery>): Promise<SearchFacet> {
    // const { index } = params.query
    // const types = getFacetTypes(type, this.index)

    // init with limit and skip
    const facetsq: FacetsQueryPart = {
      offset: params.query?.skip,
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
      offset: params.query?.skip,
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
      skip: facetsq.offset ?? 0,
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

    const indexFacets = getIndexMeta(index).facets as Record<string, any>

    const facets = lodash(types)
      .map((d: string) => {
        const facet = {
          k: d,
          ...indexFacets[d],
          ...facetsq,
          other: 'all',
        }
        if (types.includes('collection')) {
          facet.prefix = isAuthenticated ? userId : '-'
        }
        return facet
      })
      .keyBy('k')
      .mapValues((v: Record<string, any>) => lodash.omit(v, 'k'))
      .value()

    debug(
      `[get] "${types.join(', ')}" (${canBeCached ? 'cached' : 'not cached'}):`,
      `index: ${index}`,
      'facets:',
      facets,
      'groupby',
      sanitizedParams.groupby || 'none'
    )
    const query: Record<string, any> = {
      q: sanitizedParams.sq,
      'json.facet': JSON.stringify(facets),
      start: 0,
      rows: 0,
      hl: false,
      vars: sanitizedParams.sv,
    }

    if (sanitizedParams.groupby) {
      query.fq = `{!collapse field=${sanitizedParams.groupby}}`
    }
    const result = await measureTime(
      () => this.solr.get(query, index, { skipCache: true }), //! canBeCached }),
      'search-facets.get.solr.facets'
    )
    return types.map(t => {
      const rangeFacetMetadata = getRangeFacetMetadata(indexFacets[t])
      // check that facetsq params are all defined
      if (facetsQueryPart.start == null || !isNaN(facetsQueryPart.start)) {
        rangeFacetMetadata.min = facetsQueryPart.start
      }
      if (facetsQueryPart.end == null || !isNaN(facetsQueryPart.end)) {
        rangeFacetMetadata.max = facetsQueryPart.end
      }
      if (facetsQueryPart.gap == null || !isNaN(facetsQueryPart.gap)) {
        rangeFacetMetadata.gap = facetsQueryPart.gap
      }
      return new SearchFacetModel({
        type: t,
        // default min max and gap values from default solr config
        ...result.facets[t],
        ...rangeFacetMetadata,
        numBuckets: result.facets[t] ? result.facets[t].numBuckets || result.facets[t].buckets.length : 0,
      })
    })
  }
}
