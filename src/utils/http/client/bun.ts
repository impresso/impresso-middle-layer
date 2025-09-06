import { SolrServerProxy } from '../../../configuration.js'
import { logger } from '../../../logger.js'
import { FetchOptions, IFetchClient, IFetchClientOptions } from './base.js'

/**
 * Bun implementation of IFetchClient
 * Takes advantage of Bun's native fetch with better performance
 */
export class BunFetchClient implements IFetchClient {
  private socksProxy?: SolrServerProxy

  constructor(options: IFetchClientOptions) {
    console.log('Using BunFetchClient')
    this.socksProxy = options.socksProxy
  }

  /**
   * Configure fetch options including proxy settings if needed
   */
  private configureFetchOptions(init?: RequestInit, options?: FetchOptions): RequestInit {
    const fetchInit = { ...init } as RequestInit & { signal?: AbortSignal }

    // Setup timeout
    if (options?.requestTimeoutMs) {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => {
        controller.abort('Request timed out')
      }, options.requestTimeoutMs)

      // Clear the timeout when the request completes
      fetchInit.signal = controller.signal

      // Store the timeout ID for cleanup
      const originalSignal = init?.signal
      if (originalSignal) {
        originalSignal.addEventListener('abort', () => {
          clearTimeout(timeoutId)
        })
      }
    }

    // Configure proxy if needed
    if (this.socksProxy) {
      // Bun doesn't have built-in SOCKS proxy support like Node.js
      // We would need to set environment variables or use a different approach
      // This is a placeholder for actual implementation
      logger.warn('SOCKS proxy support in Bun is not fully implemented yet')
    }

    return fetchInit
  }

  /**
   * Implements fetch with retry logic
   */
  async fetch(input: string | URL | globalThis.Request, init?: RequestInit, options?: FetchOptions): Promise<Response> {
    const url = input.toString()
    const fetchOptions = this.configureFetchOptions(init, options)

    // If we have retry options, implement retry logic
    if (options?.retryOptions) {
      const maxRetries = options.retryOptions.maxRetries ?? 3
      const defaultDelay = 500 // Default retry delay if not specified

      let lastError: Error | undefined

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          const response = await fetch(input, fetchOptions)

          // Handle unsuccessful responses
          if (!response.ok && options.onUnsuccessfulResponse) {
            try {
              const body = typeof fetchOptions.body === 'object' ? (fetchOptions.body as Record<string, any>) : {}
              await options.onUnsuccessfulResponse(url, fetchOptions.method || 'GET', body, response)
            } catch (error) {
              // Ignore errors in the handler
            }
          }

          return response
        } catch (error) {
          lastError = error as Error

          // Don't wait on the last attempt
          if (attempt < maxRetries) {
            // Simple exponential backoff
            const delay = defaultDelay * Math.pow(2, attempt) // Exponential backoff

            logger.debug(`Retrying request ${attempt + 1} of ${maxRetries} for ${url} after ${delay}ms`)
            await new Promise(resolve => setTimeout(resolve, delay))
          } else {
            logger.error(`Max retries reached for ${url}. Last error: ${lastError.message}`)
          }
        }
      }

      // If we got here, all retries failed
      throw lastError || new Error(`Failed to fetch ${url} after ${maxRetries} retries`)
    } else {
      // No retries, just fetch
      const response = await fetch(input, fetchOptions)

      // Handle unsuccessful responses
      if (!response.ok && options?.onUnsuccessfulResponse) {
        try {
          const body = typeof fetchOptions.body === 'object' ? (fetchOptions.body as Record<string, any>) : {}
          await options.onUnsuccessfulResponse(url, fetchOptions.method || 'GET', body, response)
        } catch (error) {
          // Ignore errors in the handler
        }
      }

      return response
    }
  }
}
