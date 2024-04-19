import type { HookContext, NextFunction } from '@feathersjs/feathers'
import type { ImpressoApplication } from '../types'
import { TooManyRequests } from '@feathersjs/errors'
import { logger } from '../logger'

export const DefaultResource = 'default'

const _isTopLevelService = (context: HookContext<ImpressoApplication>) => {
  return context.params.headers != null
}

/**
 * A "before" hook that rate limits requests based on the user id and resource.
 * Requires the rateLimiter service to be available. If it's not - the
 * hook does nothing.
 *
 * @param resource - string tag of the resource to rate limit.
 */
export const rateLimitCheck = (resource: string) => async (context: HookContext<ImpressoApplication>) => {
  // do nothing if it's not a top level service context (called by another service)
  // becasue we don't want to double rate limit
  if (!_isTopLevelService(context)) return

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

/**
 * An "after" hook that adds the rate limiting header to the response.
 */
export const addRateLimitingHeader = async (context: HookContext<ImpressoApplication>) => {
  // do nothing if it's not a top level service context (called by another service)
  // becasue we don't want to double rate limit
  if (!_isTopLevelService(context)) return

  const rateLimitingResult = context.rateLimitingResult
  if (rateLimitingResult == null) return

  if (context.http == null) context.http = {}

  context.http.headers = {
    ...(context.http.headers ?? {}),
    'X-RateLimit': `Used=${rateLimitingResult.usedTokens}; Total=${rateLimitingResult.totalTokens}`,
  }
}

/**
 * An "error" hook that reverts the previous rate limit call in case of a 5XX error or
 * an unexpected error.
 * @param resource - string tag of the resource to rate limit.
 */
export const rollbackRateLimit = (resource: string) => async (context: HookContext<ImpressoApplication>) => {
  // do nothing if it's not a top level service context (called by another service)
  // becasue we don't want to double rate limit
  if (!_isTopLevelService(context)) return

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

  const result = await rateLimiter.undo(userId, resource)
  context.rateLimitingResult = result
}

/**
 * An "around" hook that wraps the rate limit check, the service call, and the header addition.
 * Using this hook is preferred over multiple hooks.
 * @param resource
 * @returns
 */
export const rateLimit =
  (resource: string = DefaultResource) =>
  async (context: HookContext<ImpressoApplication>, next: NextFunction) => {
    try {
      await rateLimitCheck(resource)(context)
      await next()
    } catch (error) {
      await rollbackRateLimit(resource)(context)
      throw error
    } finally {
      await addRateLimitingHeader(context)
    }
  }
