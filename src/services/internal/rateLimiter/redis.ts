import * as path from 'path'
import { fileURLToPath } from 'url'
import { disallow } from 'feathers-hooks-common'
import { readFileSync } from 'fs'
import { logger } from '@/logger.js'
import { RedisClient } from '@/redis.js'
import type { ImpressoApplication } from '@/types.js'
import { ensureServiceIsFeathersCompatible } from '@/util/feathers.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const rateLimiterScript = readFileSync(path.join(__dirname, 'lua/leakyBucketRateLimit.lua')).toString()
const rateLimiterRevertScript = readFileSync(path.join(__dirname, 'lua/leakyBucketTakeToken.lua')).toString()

export interface RateLimitingResult {
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
  undo(userId: string, resource: string): Promise<RateLimitingResult>
}

class NullRateLimiter implements IRateLimiter {
  async allow(userId: string, resource: string): Promise<RateLimitingResult> {
    return { usedTokens: 0, totalTokens: 0, isAllowed: true }
  }
  async undo(userId: string, resource: string): Promise<RateLimitingResult> {
    return { usedTokens: 0, totalTokens: 0, isAllowed: true }
  }
}

/**
 * Rate limiter configuration section type in the configuration file.
 */
export interface RateLimitPolicy {
  capacity: number
  refillRate: number // requests / second
  enabled?: boolean
}

export interface RateLimiterConfiguration extends RateLimitPolicy {
  resources?: Record<string, RateLimitPolicy>
}

export const getRateLimitPolicy = (configuration: RateLimiterConfiguration, resource: string): RateLimitPolicy =>
  configuration.resources?.[resource] ?? {
    capacity: configuration.capacity,
    refillRate: configuration.refillRate,
  }

// Resource-level `enabled` overrides the global flag; global defaults to false.
const isResourceEnabled = (configuration: RateLimiterConfiguration, resource: string): boolean => {
  const resourcePolicy = configuration.resources?.[resource]
  if (resourcePolicy?.enabled != null) return resourcePolicy.enabled
  return configuration.enabled ?? false
}

const hasAnyEnabled = (configuration: RateLimiterConfiguration): boolean =>
  (configuration.enabled ?? false) || Object.values(configuration.resources ?? {}).some(p => p.enabled === true)

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
    if (!isResourceEnabled(this.configuration, resource)) return { usedTokens: 0, totalTokens: 0, isAllowed: true }
    if (this.rateLimiterScriptSha == null) throw new Error('Rate limiter not initialized')

    const policy = getRateLimitPolicy(this.configuration, resource)

    const usedTokens = await this.redisClient.evalSha(this.rateLimiterScriptSha, {
      keys: [getKey(userId, resource)],
      arguments: [String(policy.capacity), String(policy.refillRate)],
    })
    return {
      usedTokens: Number(usedTokens) + 1,
      totalTokens: policy.capacity,
      isAllowed: Number(usedTokens) < policy.capacity,
    }
  }
  async undo(userId: string, resource: string): Promise<RateLimitingResult> {
    if (!isResourceEnabled(this.configuration, resource)) return { usedTokens: 0, totalTokens: 0, isAllowed: true }
    if (this.rateLimiterRevertScriptSha == null) throw new Error('Rate limiter not initialized')

    const policy = getRateLimitPolicy(this.configuration, resource)

    const usedTokens = await this.redisClient.evalSha(this.rateLimiterRevertScriptSha, {
      keys: [getKey(userId, resource)],
    })

    return {
      usedTokens: Number(usedTokens) + 1,
      totalTokens: policy.capacity,
      isAllowed: Number(usedTokens) < policy.capacity,
    }
  }
}

/**
 * Initializes the rate limiter service and attaches it to the app.
 */
export default (app: ImpressoApplication) => {
  // Rate limiter is enabled when it's explicitly enabled in
  // the configuration and Redis is available.
  const rateLimiterConfiguration = app.get('rateLimiter')
  let rateLimiter: IRateLimiter = new NullRateLimiter()

  if (rateLimiterConfiguration != null && hasAnyEnabled(rateLimiterConfiguration)) {
    const redisClient = app.service('redisClient').client

    if (redisClient == null) {
      logger.info('Rate limiter is disabled because Redis is disabled.')
    } else {
      rateLimiter = new RateLimiter(redisClient, rateLimiterConfiguration)
    }
  } else {
    logger.info('Rate limiter is disabled.')
  }
  // Attach it to the app.
  app.use('rateLimiter', ensureServiceIsFeathersCompatible(rateLimiter), { methods: [] })
  // Mark the service as internal - no external use allowed.
  app.service('rateLimiter').hooks({
    before: {
      all: disallow('external'),
    },
  })
}
