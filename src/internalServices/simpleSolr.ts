import { preprocessSolrError } from '@/util/solr/errors'
import { Cache } from '../cache'
import { SolrFacetQueryParams } from '../data/types'
import { ConnectionPool, Headers, initHttpPool, RequestInit } from '../httpConnectionPool'
import { logger } from '../logger'
import {
  SolrConfiguration,
  SolrServerAuth,
  SolrServerConfiguration,
  SolrServerNamespaceConfiguration,
} from '../models/generated/common'
import { checkResponseStatus, defaultFetchOptions, sanitizeSolrResponse, SolrNamespace, SolrNamespaces } from '../solr'
import { ImpressoApplication } from '../types'
import { createSha256Hash } from '../util/crypto'
import { ensureServiceIsFeathersCompatible } from '../util/feathers'
import { serialize } from '../util/serialize'
import { defaultCachingStrategy } from '../util/solr/cacheControl'

export interface SelectRequestBody {
  query: string | Record<string, unknown>
  filter?: string
  limit?: number
  offset?: number
  facet?: Record<string, SolrFacetQueryParams>
  fields?: string
  sort?: string
  params?: Record<string, string | number | boolean>
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
  QTime?: number
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

export type BucketValue = string | number | Bucket

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

  grouped?: Record<string, any>
  highlighting?: Record<string, any>
  fragments?: Record<string, any>
  stats?: {
    stats_fields?: {
      statistics?: any
    }
  }
}

/**
 * Simplified Solr client interface with strict types that follow Solr request/response schemas.
 * Aims to replace all the other varied Solr client interfaces in the codebase.
 */
export interface SimpleSolrClient {
  namespaces: typeof SolrNamespaces

  select<T = Record<string, unknown>, K extends string = string, B extends BucketValue = Bucket>(
    namespace: SolrNamespace,
    request: SelectRequest
  ): Promise<SelectResponse<T, K, B>>
  selectOne<T = Record<string, unknown>>(namespace: SolrNamespace, request: SelectRequest): Promise<T | undefined>
}

interface PoolWrapper {
  pool: ConnectionPool
  baseUrl: string
  auth?: SolrServerConfiguration['auth']
}

const buildAuthHeader = (auth?: SolrServerAuth): Record<string, string> => {
  if (auth == null) {
    return {}
  }

  const { username, password } = auth
  const encoded = Buffer.from(`${username}:${password}`).toString('base64')
  return {
    Authorization: `Basic ${encoded}`,
  }
}

class DefaultSimpleSolrClient implements SimpleSolrClient {
  namespaces = SolrNamespaces

  private _pools: Record<string, PoolWrapper> = {}
  private _namespaces: Record<string, SolrServerNamespaceConfiguration> = {}

  constructor(configuration: SolrConfiguration) {
    this._pools =
      configuration?.servers?.reduce(
        (acc, server) => {
          const socksProxy = server.proxy != null ? { host: server.proxy.host, port: server.proxy.port } : undefined
          acc[server.id] = {
            pool: initHttpPool({ socksProxy }),
            auth: server.auth,
            baseUrl: server.baseUrl,
          }
          return acc
        },
        {} as Record<string, PoolWrapper>
      ) ?? {}
    this._namespaces =
      configuration?.namespaces?.reduce(
        (acc, namespace) => {
          acc[namespace.namespaceId] = namespace
          return acc
        },
        {} as Record<string, SolrServerNamespaceConfiguration>
      ) ?? {}
  }

  private getPool(namespace: string): [PoolWrapper, SolrServerNamespaceConfiguration] {
    const namespaceObj = this._namespaces[namespace]
    const serverId = namespaceObj?.serverId
    if (serverId == null) {
      throw new Error(`Namespace ${namespace} not found in configuration`)
    }
    return [this._pools[serverId], namespaceObj]
  }

  protected async fetch(pool: ConnectionPool, url: string, init: RequestInit): Promise<string> {
    const client = await pool.acquire()

    try {
      const response = await client.fetch(url, init, defaultFetchOptions)
      const successfulResponse = await checkResponseStatus(response)
      const responseBodyText = await successfulResponse.text()
      return sanitizeSolrResponse(responseBodyText)
    } catch (e) {
      throw preprocessSolrError(e as Error)
    } finally {
      await pool.release(client).catch(e => logger.error(`Failed to release connection: ${e}`))
    }
  }

  async select<T = Record<string, unknown>, K extends string = string, B extends BucketValue = Bucket>(
    namespaceId: SolrNamespace,
    request: SelectRequest
  ): Promise<SelectResponse<T, K, B>> {
    const [{ pool, baseUrl, auth: { read: auth } = {} }, namespace] = this.getPool(namespaceId)

    const url = `${baseUrl}/${namespace.index}/select`
    const init: RequestInit = {
      method: 'POST',
      headers: new Headers({
        ...buildAuthHeader(auth),
        'Content-Type': 'application/json',
      }),
      body: JSON.stringify(request.body),
    }

    const responseBody = await this.fetch(pool, url, init)
    return JSON.parse(responseBody)
  }

  async selectOne<T = Record<string, unknown>>(
    namespace: SolrNamespace,
    request: SelectRequest
  ): Promise<T | undefined> {
    const result = await this.select<T>(namespace, request)
    return result.response?.docs?.[0]
  }
}

const buildCacheKey = (url: string, body: Record<string, unknown>) => {
  const bodyString = serialize(body)
  const urlHash = createSha256Hash(url)
  const bodyHash = createSha256Hash(bodyString)
  return ['cache', 'solr', urlHash, bodyHash].join(':')
}

export type CachingStrategy = (url: string, requestBody: string, responseBody: string) => 'cache' | 'bypass'

class CachedDefaultSimpleSolrClient extends DefaultSimpleSolrClient {
  constructor(
    configuration: SolrConfiguration,
    private cache: Cache,
    private cachingStrategy?: CachingStrategy
  ) {
    super(configuration)
  }

  protected async fetch(pool: ConnectionPool, url: string, init: RequestInit): Promise<string> {
    const cacheKey = buildCacheKey(url, { method: init.method, body: init.body })
    const cachedResponse = await this.cache.get<string>(cacheKey)
    if (cachedResponse != null) {
      return cachedResponse
    }

    const response = await super.fetch(pool, url, init)

    const action = this.cachingStrategy?.(url, init.body as string, JSON.stringify(response)) ?? 'cache'

    if (action === 'cache') {
      await this.cache.set(cacheKey, response)
    }
    return response
  }
}

export const init = (app: ImpressoApplication) => {
  const cache = app.get('cacheManager')
  const solrConfiguration = app.get('solrConfiguration')
  if (solrConfiguration == null) {
    throw new Error('Solr configuration not found')
  }
  const client = new CachedDefaultSimpleSolrClient(solrConfiguration, cache, defaultCachingStrategy)

  app.use('simpleSolrClient', ensureServiceIsFeathersCompatible(client), {
    methods: [],
  })
}
