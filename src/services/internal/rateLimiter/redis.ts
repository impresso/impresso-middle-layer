import { disallow } from 'feathers-hooks-common'
import { readFileSync } from 'fs'
import { logger } from '../../../logger'
import { RedisClient } from '../../../redis'
import type { ImpressoApplication } from '../../../types'
import { ensureServiceIsFeathersCompatible } from '../../../util/feathers'

const rateLimiterScript = readFileSync(`${__dirname}/lua/leakyBucketRateLimit.lua`).toString()
const rateLimiterRevertScript = readFileSync(`${__dirname}/lua/leakyBucketTakeToken.lua`).toString()

interface RateLimitingResult {
  usedTokens: number
  totalTokens: number
  isAllowed: boolean
}

/**
 * Rate limiter interface.
 */
export interface IRateLimiter {
  /**
   * Put a token in the bucket and return true if the request is allowed.
   */
  allow(userId: string, resource: string): Promise<RateLimitingResult>
  /**
   * Take a token from the bucket if we put one before and there was
   * an error caused by us. We don't want to penalize the user for
   * it.
   */
  undo(userId: string, resource: string): Promise<void>
}

/**
 * Rate limiter configuration section type in the configuration file.
 */
export interface RateLimiterConfiguration {
  capacity: number
  refillRate: number // requests / second
}

/**
 * Redis key for the rate limiter.
 */
const getKey = (userId: string, resource: string) => `RL:${userId}:${resource}`

/**
 * Redis based implementation of the rate limiter.
 * It uses a leaky bucket algorithm to limit the rate of requests.
 * See the lua scripts for more details.
 */
class RateLimiter implements IRateLimiter {
  initialized: boolean
  redisClient: RedisClient
  configuration: RateLimiterConfiguration
  rateLimiterScriptSha?: string
  rateLimiterRevertScriptSha?: string

  constructor(redisClient: RedisClient, configuration: RateLimiterConfiguration) {
    this.redisClient = redisClient
    this.initialized = false
    this.configuration = configuration
  }

  async setup(app: ImpressoApplication, path: string) {
    if (this.initialized) return

    this.rateLimiterScriptSha = await this.redisClient.scriptLoad(rateLimiterScript)
    this.rateLimiterRevertScriptSha = await this.redisClient.scriptLoad(rateLimiterRevertScript)
  }

  async allow(userId: string, resource: string): Promise<RateLimitingResult> {
    if (this.rateLimiterScriptSha == null) throw new Error('Rate limiter not initialized')

    const usedTokens = await this.redisClient.evalSha(this.rateLimiterScriptSha, {
      keys: [getKey(userId, resource)],
      arguments: [String(this.configuration.capacity), String(this.configuration.refillRate)],
    })
    return {
      usedTokens: Number(usedTokens) + 1,
      totalTokens: this.configuration.capacity,
      isAllowed: Number(usedTokens) < this.configuration.capacity,
    }
  }
  async undo(userId: string, resource: string): Promise<void> {
    if (this.rateLimiterRevertScriptSha == null) throw new Error('Rate limiter not initialized')

    await this.redisClient.evalSha(this.rateLimiterRevertScriptSha, {
      keys: [getKey(userId, resource)],
    })
  }
}

/**
 * Initializes the rate limiter service and attaches it to the app.
 */
export default (app: ImpressoApplication) => {
  // Rate limiter is enabled when it's explicitly enabled in
  // the configuration and Redis is available.
  const rateLimiterConfiguration = app.get('rateLimiter')
  if (!rateLimiterConfiguration?.enabled) {
    logger.info('Rate limiter is disabled.')
    return
  } else {
    logger.info(`Rate limiter is enabled and configured with: ${JSON.stringify(rateLimiterConfiguration)}`)
  }

  const redisClient = app.service('redisClient').client
  if (redisClient == null) {
    logger.info('Rate limiter is disabled because Redis is disabled.')
    return
  }

  // Create the rate limiter service.
  const rateLimiter = new RateLimiter(redisClient, rateLimiterConfiguration)
  // Attach it to the app.
  app.use('rateLimiter', ensureServiceIsFeathersCompatible(rateLimiter), { methods: [] })
  // Mark the service as internal - no external use allowed.
  app.service('rateLimiter').hooks({
    before: {
      all: disallow('external'),
    },
  })
}
