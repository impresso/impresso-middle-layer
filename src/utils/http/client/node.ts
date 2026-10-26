import { request, Dispatcher, Agent, RetryAgent, RetryHandler } from 'undici'

import { socksDispatcher, SocksProxies } from 'fetch-socks'
import type { IncomingHttpHeaders } from 'undici/types/header.d.ts'
import { SolrServerProxy } from '../../../configuration.js'
import type { FetchOptions, IFetchClient, IFetchClientOptions } from './base.ts'

const DefaultRequestTimeoutMs = 300 * 1000
const DefaultConnectTimeoutMs = 10 * 1000
const DefaultAutoSelectFamilyAttemptTimeoutMs = 2 * 1000
const DefaultKeepAliveTimeoutMs = 10 * 1000
const DefaultMaxConnectionsPerOrigin = 200
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
// Connect timeouts are safe to retry for any method: nothing has been sent yet.
const AdditionalRetryErrorCodes = ['UND_ERR_HEADERS_TIMEOUT', 'UND_ERR_CONNECT_TIMEOUT']

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

function incomingHttpHeadersToHeaders(headers: IncomingHttpHeaders): Headers {
  const result = new Headers()

  for (const [name, value] of Object.entries(headers)) {
    if (value == null) continue

    if (Array.isArray(value)) {
      value.forEach(item => result.append(name, item))
    } else {
      result.append(name, value)
    }
  }

  return result
}

export class XResponse extends Response {
  data: Dispatcher.ResponseData
  // The body stream can be read only once. Memoise the read itself (not its result)
  // so concurrent callers (e.g. onUnsuccessfulResponse logging and checkResponseStatus)
  // share it instead of each getting a part of the stream.
  _text?: Promise<string>

  constructor(data: Dispatcher.ResponseData) {
    super(null, {
      status: data.statusCode,
      headers: incomingHttpHeadersToHeaders(data.headers),
    })
    this.data = data
  }

  get ok() {
    return this.data.statusCode >= 200 && this.data.statusCode < 300
  }

  get status() {
    return this.data.statusCode
  }

  async text() {
    this._text ??= this._readText()
    return this._text
  }

  private async _readText(): Promise<string> {
    const chunks = []
    for await (const chunk of this.data.body) {
      chunks.push(chunk)
    }
    return Buffer.concat(chunks).toString('utf8')
  }

  async json() {
    const text = await this.text()
    return JSON.parse(text)
  }
}

function createBaseAgent(socksProxy?: SolrServerProxy): Agent {
  const commonOptions = {
    connections: DefaultMaxConnectionsPerOrigin,
    keepAliveTimeout: DefaultKeepAliveTimeoutMs,
    connectTimeout: DefaultConnectTimeoutMs,
  }

  if (socksProxy != null) {
    const proxyConfig: SocksProxies = [
      {
        type: 5,
        host: socksProxy.host,
        port: socksProxy.port,
      },
    ]
    return socksDispatcher(proxyConfig, {
      ...commonOptions,
      connect: {
        // set some TLS options
        rejectUnauthorized: false,
      },
    })
  }

  return new Agent({
    ...commonOptions,
    // Node's "happy eyeballs" gives every resolved address only a short window
    // (250-500ms by default) before moving on to the next one. When one address
    // family is unreachable, a slightly slow connect on the other one fails
    // the whole connection with ETIMEDOUT, which undici reports as a
    // "Connect Timeout Error" regardless of `connectTimeout`.
    autoSelectFamily: true,
    autoSelectFamilyAttemptTimeout: DefaultAutoSelectFamilyAttemptTimeoutMs,
  })
}

function buildRetryOptions(retryOptions: RetryHandler.RetryOptions, requestTimeoutMs: number): RetryHandler.RetryOptions {
  const mergedErrorCodes = Array.from(
    new Set([...(retryOptions.errorCodes ?? UndiciDefaultRetryErrorCodes), ...AdditionalRetryErrorCodes])
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

/**
 * undici based IFetchClient.
 *
 * A single agent is shared by all requests made through this client so that
 * connections (and TLS sessions) are kept alive and reused instead of being
 * re-established for every request.
 */
export class FetchClient implements IFetchClient {
  private readonly agent: Agent

  constructor(options: IFetchClientOptions) {
    this.agent = createBaseAgent(options.socksProxy)
  }

  async close(): Promise<void> {
    await this.agent.close()
  }

  async fetch(url: string | URL | globalThis.Request, init?: RequestInit, options?: FetchOptions): Promise<Response> {
    const body = init?.body instanceof URLSearchParams ? urlSearchParamsToFormData(init.body) : init?.body

    if (url instanceof Request) throw new Error('Request object not supported by undici')

    const requestTimeoutMs = options?.requestTimeoutMs ?? DefaultRequestTimeoutMs

    // RetryAgent only wraps the shared agent and does not own any connections,
    // so it is cheap to create one per request with request specific options.
    const dispatcher: Dispatcher =
      options?.retryOptions != null
        ? new RetryAgent(this.agent, buildRetryOptions(options.retryOptions, requestTimeoutMs))
        : this.agent

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
        dispatcher,
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

      // Drain the discarded response so its connection can be reused.
      await result.body.dump()
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
