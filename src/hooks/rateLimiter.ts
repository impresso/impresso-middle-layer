import type { HookContext } from '@feathersjs/feathers'
import type { ImpressoApplication } from '../types'
import { TooManyRequests } from '@feathersjs/errors'
import { logger } from '../logger'

export const DefaultResource = 'default'

/**
 * Hook that rate limits requests based on the user id and resource.
 * Requires the rateLimiter service to be available. If it's not - the
 * hook does nothing.
 *
 * @param resource - string tag of the resource to rate limit.
 */
export const rateLimit = (resource: string) => async (context: HookContext<ImpressoApplication>) => {
  const rateLimiter = context.app.service('rateLimiter')
  if (rateLimiter == null) return

  const userId: string = context.params?.user?.uid
  if (userId == null) {
    logger.warn('Cannot rate limit unauthenticated request')
    return
  }

  const result = await rateLimiter.allow(userId, resource)
  if (!result.isAllowed) {
    throw new TooManyRequests('Rate limit exceeded')
  }
  context.rateLimitingResult = result
}

export const addRateLimitingHeader = async (context: HookContext<ImpressoApplication>) => {
  const rateLimitingResult = context.rateLimitingResult
  if (rateLimitingResult == null) return

  if (context.http == null) throw new Error('Result is not present. Use this hook after the service call.')

  context.http.headers = {
    ...(context.http.headers ?? {}),
    'X-RateLimit': `Used=${rateLimitingResult.usedTokens}; Total=${rateLimitingResult.totalTokens}`,
  }
}

/**
 * Hook that reverts the previous rate limit call in case of a 5XX error or
 * an unexpected error.
 * @param resource - string tag of the resource to rate limit.
 */
export const rollbackRateLimit = (resource: string) => async (context: HookContext<ImpressoApplication>) => {
  // Only roll back for unexpected server errors.
  const errorCode: number | undefined = context.error?.code
  if (context.error != null && errorCode != null && errorCode < 500) return

  const rateLimiter = context.app.service('rateLimiter')
  if (rateLimiter == null) return

  const userId: string = context.params?.user?.uid
  if (userId == null) {
    logger.warn('Cannot rollback rate limit for unauthenticated requests')
    return
  }

  await rateLimiter.undo(userId, resource)
}
