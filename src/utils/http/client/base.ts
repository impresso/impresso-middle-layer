import type { SolrServerProxy } from '../../../configuration'
import type { RetryHandler } from 'undici'

export type RetryOptions = RetryHandler.RetryOptions

export interface IFetchClientOptions {
  socksProxy?: SolrServerProxy
}

export interface FetchOptions {
  requestTimeoutMs?: number
  retryOptions?: RetryOptions
  onUnsuccessfulResponse?: (url: string, method: string, body: Record<string, any>, response: Response) => Promise<void>
}

export interface IFetchClient {
  fetch(input: string | URL | globalThis.Request, init?: RequestInit, options?: FetchOptions): Promise<Response>
}
