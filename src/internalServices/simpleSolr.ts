import { CachedSolrClient } from '../cachedSolr'
import { SolrFacetQueryParams } from '../data/types'
import { ImpressoApplication } from '../types'
import { ensureServiceIsFeathersCompatible } from '../util/feathers'

export interface SelectRequestBody {
  query: string | Record<string, unknown>
  filter?: string
  limit?: number
  offset?: number
  facet?: Record<string, SolrFacetQueryParams>
}

export interface SelectQueryParameters {
  fl?: string
}

export interface SelectRequest {
  body: SelectRequestBody
  params?: SelectQueryParameters
}

interface ResponseHeaders {
  status?: number
}

export interface ResponseContainer<T> {
  numFound: number
  start: number
  docs: T[]
}

export interface ErrorContainer {
  metadata?: string[]
  msg: string
  code: 400
}

interface Bucket {
  val?: string | number
  count?: number
}

interface Count {
  count: number
}

interface TermsFacetDetails {
  numBuckets?: number
  buckets: Bucket[]
}

interface RangeFacetDetails {
  buckets: Bucket[]
  before?: Count
  after?: Count
  between?: Count
}

type FacetDetails = TermsFacetDetails | RangeFacetDetails

export type FacetsContainer<K extends string> = {
  [key in K]: FacetDetails
}

export interface SelectResponse<T, K extends string> {
  responseHeaders?: ResponseHeaders
  response?: ResponseContainer<T>
  error?: ErrorContainer
  facets?: FacetsContainer<K>
}

/**
 * Simplified Solr client interface with strict types that follow Solr request/response schemas.
 * Aims to replace all the other varied Solr client interfaces in the codebase.
 */
export interface SimpleSolrClient {
  select<T = Record<string, unknown>, K extends string = string>(
    namespace: string,
    request: SelectRequest
  ): Promise<SelectResponse<T, K>>
}

class CachedSolrSimpleSolrClient implements SimpleSolrClient {
  constructor(private readonly client: CachedSolrClient) {}

  async select<T = Record<string, unknown>, K extends string = string>(
    namespace: string,
    request: SelectRequest
  ): Promise<SelectResponse<T, K>> {
    return await this.client.post(request.body, namespace)
  }
}

export const init = (app: ImpressoApplication) => {
  const originalCachedClient = app.service('cachedSolr')
  const client = new CachedSolrSimpleSolrClient(originalCachedClient)

  app.use('simpleSolrClient', ensureServiceIsFeathersCompatible(client), {
    methods: [],
  })
}
