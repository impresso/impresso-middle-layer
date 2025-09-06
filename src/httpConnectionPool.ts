import { request, Dispatcher, Agent, RetryAgent, RetryHandler, Headers } from 'undici'
import type { RequestInfo, RequestInit } from 'undici'

import { socksDispatcher, SocksProxies } from 'fetch-socks'
import { createPool, Factory, Pool } from 'generic-pool'
import { IncomingHttpHeaders } from 'undici/types/header'
import { SolrServerProxy } from './configuration'
import { logger } from './logger'

export { RequestInfo, RequestInit, Headers }

export interface IResponse {
  get ok(): boolean
  get statusCode(): number
  text(): Promise<string>
  json(): Promise<any>
}

export interface FetchOptions {
  requestTimeoutMs?: number
  retryOptions?: RetryHandler.RetryOptions
  onUnsuccessfulResponse?: (url: string, method: string, body: Record<string, any>, response: IResponse) => void
}

interface IConnectionWrapper {
  fetch(url: RequestInfo, init?: RequestInit, options?: FetchOptions): Promise<IResponse>
}

function urlSearchParamsToFormData(urlSearchParams: URLSearchParams): FormData {
  const formData = new FormData()

  for (const [key, value] of urlSearchParams.entries()) {
    // Handle arrays
    if (Array.isArray(value)) {
      for (const item of value) {
        formData.append(key, item)
      }
    } else {
      formData.append(key, value)
    }
  }

  return formData
}

export class Response implements IResponse {
  data: Dispatcher.ResponseData
  _text?: string

  constructor(data: Dispatcher.ResponseData) {
    this.data = data
  }

  get ok() {
    return this.data.statusCode >= 200 && this.data.statusCode < 300
  }

  get statusCode() {
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
class ConnectionWrapper implements IConnectionWrapper {
  socksProxyOptions?: SolrServerProxy

  constructor(socksProxyOptions?: SolrServerProxy) {
    this.socksProxyOptions = socksProxyOptions
  }

  _createBaseAgent(): Agent {
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
      return new Agent()
    }
  }

  async fetch(url: RequestInfo, init?: RequestInit, options?: FetchOptions): Promise<IResponse> {
    const body = init?.body instanceof URLSearchParams ? urlSearchParamsToFormData(init.body) : init?.body

    if (url instanceof Request) throw new Error('Request object not supported by undici')

    const theUrl: string = url instanceof Request ? url.url : new String(url).toString()

    const agent =
      options?.retryOptions != null
        ? new RetryAgent(this._createBaseAgent(), {
            ...(options?.retryOptions ?? {}),
            // see https://github.com/nodejs/undici/discussions/3072
            errorCodes: ['UND_ERR_HEADERS_TIMEOUT'],
            retry: (err, ctx, cb) => {
              const retryCount = ctx.state.counter
              const maxRetries = ctx.opts.retryOptions?.maxRetries ?? 0
              const shouldRetry = retryCount <= maxRetries

              const retryConfig = ctx.opts.retryOptions

              if (!shouldRetry) {
                logger.error(
                  `Max retries reached for ${theUrl} with ${body}. Retry config: ${JSON.stringify(retryConfig)}`
                )
                return cb(err)
              } else {
                logger.debug(`Retrying request ${retryCount} of ${maxRetries} for ${theUrl} with ${body}`)
                cb()
              }
            },
          })
        : this._createBaseAgent()

    const result = await request(theUrl, {
      method: init?.method as Dispatcher.HttpMethod,
      headers: init?.headers as IncomingHttpHeaders,
      body: body as any,
      dispatcher: agent,
      headersTimeout: options?.requestTimeoutMs ?? 30 * 1000,
    })
    const response = new Response(result)
    await response.text()
    if (!response.ok) {
      try {
        options?.onUnsuccessfulResponse?.(theUrl, init?.method as string, body as Record<string, any>, response)
      } catch (error) {
        // do nothing
      }
    }

    return response
  }
}

class ConnectionFactory implements Factory<IConnectionWrapper> {
  socksProxyOptions?: SolrServerProxy

  constructor(socksProxyOptions?: SolrServerProxy) {
    this.socksProxyOptions = socksProxyOptions
  }

  async create() {
    return new ConnectionWrapper(this.socksProxyOptions)
  }

  async destroy() {
    /* nothing to destroy */
  }
}

export interface InitHttpPoolOptions {
  maxParallelConnections?: number
  acquireTimeoutSec?: number
  socksProxy?: SolrServerProxy
}

export function initHttpPool({
  maxParallelConnections = 200,
  acquireTimeoutSec = 25,
  socksProxy,
}: InitHttpPoolOptions = {}): Pool<IConnectionWrapper> {
  const poolOptions = {
    min: maxParallelConnections ?? 200,
    max: maxParallelConnections ?? 200,
    acquireTimeoutMillis: acquireTimeoutSec * 1000,
  }

  return createPool(new ConnectionFactory(socksProxy), poolOptions)
}

type ConnectionPool = Pool<IConnectionWrapper>

export { ConnectionPool }
