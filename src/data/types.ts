/**
 * https://solr.apache.org/guide/8_1/json-facet-api.html#range-facet-parameters
 */
export interface SolrRangeFacetQueryParams {
  type: 'range'
  field: string
  start: string | number
  end: string | number
  gap: string | number

  other?: 'before' | 'after' | 'between' | 'none' | 'all'
  include?: 'lower' | 'upper' | 'edge' | 'outer' | 'all'
}

/**
 * https://solr.apache.org/guide/8_1/json-facet-api.html#terms-facet
 */
export interface SolrTermsFacetQueryParams {
  type: 'terms'
  field: string

  offset?: number
  limit?: number
  sort?: {
    count?: 'asc' | 'desc'
    index?: 'asc' | 'desc'
  }
  mincount?: number
  numBuckets?: boolean

  prefix?: string
}

export type SolrFacetQueryParams = SolrRangeFacetQueryParams | SolrTermsFacetQueryParams

export const isSolrRangeFacetQuerParams = (params: SolrFacetQueryParams): params is SolrRangeFacetQueryParams => {
  return params.type === 'range'
}

export const isSolrTermsFacetQuerParams = (params: SolrFacetQueryParams): params is SolrTermsFacetQueryParams => {
  return params.type === 'terms'
}
