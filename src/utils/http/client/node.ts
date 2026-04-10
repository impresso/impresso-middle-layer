import { request, Dispatcher, Agent, RetryAgent, RetryHandler } from 'undici'

import { socksDispatcher, SocksProxies } from 'fetch-socks'
import { createPool, Factory, Pool } from 'generic-pool'
import type { IncomingHttpHeaders } from 'undici/types/header.d.ts'
import { SolrServerProxy } from '../../../configuration.js'
import type { FetchOptions, IFetchClient, IFetchClientOptions } from './base.ts'

interface InitHttpPoolOptions extends IFetchClientOptions {
  maxParallelConnections?: number
  acquireTimeoutSec?: number
}

const DefaultRequestTimeoutMs = 300 * 1000
const DefaultRetryMaxRetries = 4
const DefaultRetryTimeoutFactor = 2
const UndiciDefaultRetryErrorCodes = [
  'ECONNRESET',
  'ECONNREFUSED',
  'ENOTFOUND',
  'ENETDOWN',
  'ENETUNREACH',
  'EHOSTDOWN',
  'EHOSTUNREACH',
  'EPIPE',
  'UND_ERR_SOCKET',
]
const HeadersTimeoutRetryErrorCode = 'UND_ERR_HEADERS_TIMEOUT'

function buildDefaultMinTimeout(maxTimeoutMs: number, maxRetries: number, timeoutFactor: number): number {
  if (maxTimeoutMs <= 0) return 1
  if (maxRetries <= 1 || timeoutFactor <= 1) return maxTimeoutMs

  const retryStepsBeforeCap = Math.max(maxRetries - 2, 0)
  const divisor = timeoutFactor ** retryStepsBeforeCap
  return Math.max(1, Math.floor(maxTimeoutMs / divisor))
}

function urlSearchParamsToFormData(urlSearchParams: URLSearchParams): FormData {
  const formData = new FormData()

  for (const [key, value] of urlSearchParams.entries()) {
    // URLSearchParams entries will always return strings, not arrays
    formData.append(key, value)
  }

  return formData
}

export class XResponse extends Response {
  data: Dispatcher.ResponseData
  _text?: string

  constructor(data: Dispatcher.ResponseData) {
    super()
    this.data = data
  }

  get ok() {
    return this.data.statusCode >= 200 && this.data.statusCode < 300
  }

  get status() {
    return this.data.statusCode
  }

  async text() {
    if (this._text != null) return this._text

    const chunks = []
    for await (const chunk of this.data.body) {
      chunks.push(chunk)
    }
    this._text = Buffer.concat(chunks).toString('utf8')
    return this._text
  }

  async json() {
    const text = await this.text()
    return JSON.parse(text)
  }
}

/**
 * Using a class to return by pool instead of a function
 * because functions are sometimes not recognised by the pool.
 */
class ConnectionWrapper implements IFetchClient {
  socksProxyOptions?: SolrServerProxy

  constructor(opts: IFetchClientOptions) {
    this.socksProxyOptions = opts.socksProxy
  }

  _createBaseAgent(requestTimeoutMs: number): Agent {
    if (this.socksProxyOptions != null) {
      const proxyConfig: SocksProxies = [
        {
          type: 5,
          host: this.socksProxyOptions.host,
          port: this.socksProxyOptions.port,
        },
      ]
      const socksAgent = socksDispatcher(proxyConfig, {
        connect: {
          // set some TLS options
          rejectUnauthorized: false,
        },
      })

      return socksAgent
    } else {
      return new Agent({
        headersTimeout: requestTimeoutMs,
        connectTimeout: requestTimeoutMs,
        bodyTimeout: requestTimeoutMs,
      })
    }
  }

  _buildRetryOptions(retryOptions: RetryHandler.RetryOptions, requestTimeoutMs: number): RetryHandler.RetryOptions {
    const mergedErrorCodes = Array.from(
      new Set([...(retryOptions.errorCodes ?? UndiciDefaultRetryErrorCodes), HeadersTimeoutRetryErrorCode])
    )
    const maxRetries = retryOptions.maxRetries ?? DefaultRetryMaxRetries
    const timeoutFactor = retryOptions.timeoutFactor ?? DefaultRetryTimeoutFactor
    const maxTimeout = retryOptions.maxTimeout ?? requestTimeoutMs
    const minTimeout = retryOptions.minTimeout ?? buildDefaultMinTimeout(maxTimeout, maxRetries, timeoutFactor)

    return {
      ...retryOptions,
      maxRetries,
      timeoutFactor,
      maxTimeout,
      minTimeout,
      errorCodes: mergedErrorCodes,
      // Status-code retries are handled by the application-level loop in fetch().
      // Passing statusCodes here would cause RetryAgent to also retry on them,
      // resulting in maxRetries² attempts.
      statusCodes: [],
    }
  }

  async fetch(url: string | URL | globalThis.Request, init?: RequestInit, options?: FetchOptions): Promise<Response> {
    const body = init?.body instanceof URLSearchParams ? urlSearchParamsToFormData(init.body) : init?.body

    if (url instanceof Request) throw new Error('Request object not supported by undici')

    const requestTimeoutMs = options?.requestTimeoutMs ?? DefaultRequestTimeoutMs

    const agent =
      options?.retryOptions != null
        ? new RetryAgent(
            this._createBaseAgent(requestTimeoutMs),
            this._buildRetryOptions(options.retryOptions, requestTimeoutMs)
          )
        : this._createBaseAgent(requestTimeoutMs)

    const theUrl: string = url instanceof Request ? url.url : url.toString()
    const retryStatusCodes = options?.retryOptions?.statusCodes ?? []
    const maxRetries = options?.retryOptions?.maxRetries ?? 0
    const minTimeout = options?.retryOptions?.minTimeout ?? 100
    const maxTimeout = options?.retryOptions?.maxTimeout ?? 1000
    const timeoutFactor = options?.retryOptions?.timeoutFactor ?? 1
    // Match undici's own default: only retry idempotent methods unless the caller
    // explicitly lists methods to retry.
    const retryMethods = options?.retryOptions?.methods ?? ['GET', 'HEAD', 'OPTIONS', 'PUT', 'DELETE', 'TRACE']
    const method = (init?.method ?? 'GET').toUpperCase()
    const isRetryableMethod = retryMethods.map(m => m.toUpperCase()).includes(method)

    let attempt = 0
    let response: XResponse

    do {
      const result = await request(theUrl, {
        method: init?.method as Dispatcher.HttpMethod,
        headers: init?.headers as IncomingHttpHeaders,
        body: body as any,
        signal: init?.signal,
        dispatcher: agent,
        headersTimeout: requestTimeoutMs,
        bodyTimeout: requestTimeoutMs,
      })
      response = new XResponse(result)

      if (
        response.ok ||
        !isRetryableMethod ||
        retryStatusCodes.length === 0 ||
        !retryStatusCodes.includes(response.status) ||
        attempt >= maxRetries
      )
        break

      attempt++
      const delay = Math.min(minTimeout * timeoutFactor ** (attempt - 1), maxTimeout)
      await new Promise(r => setTimeout(r, delay))
    } while (true)

    if (!response.ok) {
      try {
        // Only call the callback if the method and body are valid
        if (options?.onUnsuccessfulResponse && init?.method) {
          options.onUnsuccessfulResponse(theUrl, init.method as string, body as any, response)
        }
      } catch (error) {
        // do nothing
      }
    }

    return response
  }
}

class ConnectionFactory implements Factory<ConnectionWrapper> {
  socksProxyOptions?: SolrServerProxy

  constructor(socksProxyOptions?: SolrServerProxy) {
    this.socksProxyOptions = socksProxyOptions
  }

  async create(): Promise<ConnectionWrapper> {
    return new ConnectionWrapper({ socksProxy: this.socksProxyOptions })
  }

  async destroy(client: ConnectionWrapper): Promise<void> {
    /* nothing to destroy */
  }
}

export function initHttpPool({
  maxParallelConnections = 200,
  acquireTimeoutSec = 25,
  socksProxy,
}: InitHttpPoolOptions = {}): Pool<ConnectionWrapper> {
  const poolOptions = {
    min: maxParallelConnections ?? 200,
    max: maxParallelConnections ?? 200,
    acquireTimeoutMillis: acquireTimeoutSec * 1000,
  }

  return createPool(new ConnectionFactory(socksProxy), poolOptions)
}

export type ConnectionPool = Pool<ConnectionWrapper>

export class FetchClient implements IFetchClient {
  private pool: ConnectionPool

  constructor(options: IFetchClientOptions) {
    this.pool = initHttpPool(options)
  }

  async fetch(input: string | URL | globalThis.Request, init?: RequestInit, options?: FetchOptions): Promise<Response> {
    const client = await this.pool.acquire()
    try {
      return await client.fetch(input, init, options)
    } finally {
      await this.pool.release(client)
    }
  }
}
