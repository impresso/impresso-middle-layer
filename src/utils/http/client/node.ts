import { request, Dispatcher, Agent, RetryAgent, RetryHandler } from 'undici'

import { socksDispatcher, SocksProxies } from 'fetch-socks'
import { createPool, Factory, Pool } from 'generic-pool'
import { IncomingHttpHeaders } from 'undici/types/header'
import { SolrServerProxy } from '../../../configuration.js'
import { logger } from '../../../logger.js'
import { FetchOptions, IFetchClient, IFetchClientOptions } from './base'

interface InitHttpPoolOptions extends IFetchClientOptions {
  maxParallelConnections?: number
  acquireTimeoutSec?: number
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

  async fetch(url: string | URL | globalThis.Request, init?: RequestInit, options?: FetchOptions): Promise<Response> {
    const body = init?.body instanceof URLSearchParams ? urlSearchParamsToFormData(init.body) : init?.body

    if (url instanceof Request) throw new Error('Request object not supported by undici')

    const theUrl: string = url instanceof Request ? url.url : url.toString()

    const agent =
      options?.retryOptions != null
        ? new RetryAgent(this._createBaseAgent(), {
            ...(options?.retryOptions ?? {}),
            // see https://github.com/nodejs/undici/discussions/3072
            errorCodes: ['UND_ERR_HEADERS_TIMEOUT'],
            retry: (err, ctx, cb) => {
              const retryCount = ctx.state.counter
              // Add type assertion to fix the TypeScript error
              const opts = ctx.opts as { retryOptions?: RetryHandler.RetryOptions }
              const maxRetries = opts.retryOptions?.maxRetries ?? 0
              const shouldRetry = retryCount <= maxRetries

              const retryConfig = opts.retryOptions

              if (!shouldRetry) {
                logger.error(`Max retries reached for ${theUrl}. Retry config: ${JSON.stringify(retryConfig)}`)
                return cb(err)
              } else {
                logger.debug(`Retrying request ${retryCount} of ${maxRetries} for ${theUrl}`)
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
    const response = new XResponse(result)
    await response.text()
    if (!response.ok) {
      try {
        // Only call the callback if the method and body are valid
        if (options?.onUnsuccessfulResponse && init?.method) {
          const bodyObj = typeof body === 'object' ? (body as Record<string, any>) : {}
          options.onUnsuccessfulResponse(theUrl, init.method as string, bodyObj, response)
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
