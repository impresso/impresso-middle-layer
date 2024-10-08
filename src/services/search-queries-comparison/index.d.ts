import { Filter, Facet } from 'impresso-jscommons'

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
