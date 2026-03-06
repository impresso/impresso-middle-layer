import { Filter } from 'impresso-jscommons'

export interface Facet<T extends FilterType> {
  type: T
  buckets: SearchFacetBucket[]
  operators?: FilterOperator[]
  numBuckets?: number
}

export interface FacetRequest {
  type: string
  offset?: number
  limit?: number
}

export interface Request {
  filtersSets: Filter[][]
  facets: FacetRequest[]
}

export interface Response {
  facetsSets: Facet[][]
  intersectionFacets: Facet[]
  facetsIds: string[]
}
