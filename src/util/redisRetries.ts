import { getLogger } from '@/logger.js'

const logger = getLogger(['app', 'redis'])

export interface RetryOnLoadingOptions {
  maxWaitMs?: number
  initialDelayMs?: number
  maxDelayMs?: number
}

const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms))

export const isLoadingError = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : String(error)
  return /\bLOADING\b/.test(message)
}

export const retryOnLoadingError = async <T>(
  operation: () => Promise<T>,
  options: RetryOnLoadingOptions = {}
): Promise<T> => {
  const maxWaitMs = options.maxWaitMs ?? 2000
  const initialDelayMs = options.initialDelayMs ?? 100
  const maxDelayMs = options.maxDelayMs ?? 500

  let delayMs = initialDelayMs
  let waitedMs = 0
  for (;;) {
    try {
      return await operation()
    } catch (error) {
      if (!isLoadingError(error) || waitedMs >= maxWaitMs) throw error
      logger.warn(`Redis is loading its dataset, retrying in ${delayMs}ms (waited ${waitedMs}ms of ${maxWaitMs}ms)`, {
        error,
      })
      await sleep(delayMs)
      waitedMs += delayMs
      delayMs = Math.min(delayMs * 2, maxDelayMs)
    }
  }
}
