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

export type Bucket = {
  val?: string | number
  count?: number
} & {
  // subfacets
  [key: string]: BucketValue
}

type BucketValue = string | number | Bucket

interface Count {
  count: number
}

interface TermsFacetDetails<B extends BucketValue> {
  numBuckets?: number
  buckets: B[]
}

interface RangeFacetDetails<B extends BucketValue> {
  buckets: B[]
  before?: Count
  after?: Count
  between?: Count
}

type FacetDetails<B extends BucketValue> = TermsFacetDetails<B> | RangeFacetDetails<B>

export type FacetsContainer<K extends string, B extends BucketValue> = {
  [key in K]: FacetDetails<B>
}

export interface SelectResponse<T, K extends string, B extends BucketValue> {
  responseHeaders?: ResponseHeaders
  response?: ResponseContainer<T>
  error?: ErrorContainer
  facets?: FacetsContainer<K, B>
}

/**
 * Simplified Solr client interface with strict types that follow Solr request/response schemas.
 * Aims to replace all the other varied Solr client interfaces in the codebase.
 */
export interface SimpleSolrClient {
  select<T = Record<string, unknown>, K extends string = string, B extends BucketValue = Bucket>(
    namespace: string,
    request: SelectRequest
  ): Promise<SelectResponse<T, K, B>>
}

class CachedSolrSimpleSolrClient implements SimpleSolrClient {
  constructor(private readonly client: CachedSolrClient) {}

  async select<T = Record<string, unknown>, K extends string = string, B extends BucketValue = Bucket>(
    namespace: string,
    request: SelectRequest
  ): Promise<SelectResponse<T, K, B>> {
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
