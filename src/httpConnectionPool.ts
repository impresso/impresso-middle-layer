import { request, RequestInfo, RequestInit, Dispatcher, Agent, RetryAgent } from 'undici'
import { createPool, Factory, Pool } from 'generic-pool'
import { IncomingHttpHeaders } from 'undici/types/header'

export interface IResponse {
  get ok(): boolean
  get statusCode(): number
  text(): Promise<string>
  json(): Promise<any>
}

interface IConnectionWrapper {
  fetch(url: RequestInfo, init?: RequestInit): Promise<IResponse>
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
    if (this._text) return this._text

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
  async fetch(url: RequestInfo, init?: RequestInit): Promise<IResponse> {
    const body = init?.body instanceof URLSearchParams ? urlSearchParamsToFormData(init.body) : init?.body

    if (url instanceof Request) throw new Error('Request object not supported by undici')

    const theUrl: string = url instanceof Request ? url.url : new String(url).toString()

    const agent = new RetryAgent(new Agent(), {
      maxRetries: 3,
      maxTimeout: 10000,
    })

    const result = await request(theUrl, {
      method: init?.method as Dispatcher.HttpMethod,
      headers: init?.headers as IncomingHttpHeaders,
      body: body as any,
      dispatcher: agent,
    })

    return new Response(result)
  }
}

class ConnectionFactory implements Factory<IConnectionWrapper> {
  async create() {
    return new ConnectionWrapper()
  }

  async destroy() {
    /* nothing to destroy */
  }
}

export function initHttpPool({ maxParallelConnections = 200, acquireTimeoutSec = 25 } = {}): Pool<IConnectionWrapper> {
  const opts = {
    min: maxParallelConnections ?? 200,
    max: maxParallelConnections ?? 200,
    acquireTimeoutMillis: acquireTimeoutSec * 1000,
  }
  return createPool(new ConnectionFactory(), opts)
}

type ConnectionPool = Pool<IConnectionWrapper>

export { ConnectionPool }
