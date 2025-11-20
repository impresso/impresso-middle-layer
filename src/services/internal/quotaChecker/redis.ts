import { disallow } from 'feathers-hooks-common'
import { readFileSync } from 'fs'
import { logger } from '../../../logger'
import { RedisClient } from '../../../redis'
import type { ImpressoApplication } from '../../../types'
import { ensureServiceIsFeathersCompatible } from '../../../util/feathers'

const quotaCheckScript = readFileSync(`${__dirname}/lua/quotaCheck.lua`).toString()

/**
 * Result from a quota check operation.
 */
export interface QuotaCheckResult {
  /** Whether access was allowed (1) or denied (0) */
  allowed: boolean
  /** Current number of unique documents accessed in this window */
  count: number
  /** Whether the document being checked was counted now (1) or previously counted (0) */
  wasCounted: boolean
  /** Timestamp when the current quota window started */
  windowStart: number
  /** Seconds remaining until the quota window resets */
  secondsUntilReset: number
}

/**
 * Current quota state and usage information.
 */
export interface QuotaState {
  /** Current position in quota (unique documents accessed) */
  currentPosition: number
  /** Total quota limit */
  quota: number
  /** Percentage of quota used (0-100) */
  percentageUsed: number
  /** Seconds remaining until quota window resets */
  secondsUntilReset: number
  /** Length of the quota window in seconds */
  windowLengthSeconds: number
}

/**
 * Quota checker interface.
 */
export interface IQuotaChecker {
  /**
   * Check if a user can access a document under their quota.
   * @param userId The user ID
   * @param docId The document ID
   * @returns QuotaCheckResult with access decision and window state
   */
  check(userId: string, docId: string): Promise<QuotaCheckResult>

  /**
   * Get the current state of a user's quota.
   * @param userId The user ID
   * @returns QuotaState with current usage details
   */
  getState(userId: string): Promise<QuotaState>
}

/**
 * Null quota checker - always allows access, used when Redis is unavailable.
 */
class NullQuotaChecker implements IQuotaChecker {
  async check(userId: string, docId: string): Promise<QuotaCheckResult> {
    return {
      allowed: true,
      count: 0,
      wasCounted: false,
      windowStart: 0,
      secondsUntilReset: 0,
    }
  }

  async getState(userId: string): Promise<QuotaState> {
    return {
      currentPosition: 0,
      quota: 0,
      percentageUsed: 0,
      secondsUntilReset: 0,
      windowLengthSeconds: 0,
    }
  }
}

/**
 * Quota checker configuration from config file (uses windowDays).
 */
export interface QuotaCheckerConfigFromFile {
  enabled?: boolean
  quotaLimit: number // Maximum unique documents per user
  windowDays: number // Time window for quota in days
}

/**
 * Internal quota checker configuration (converted to seconds).
 */
interface QuotaCheckerConfiguration {
  quotaLimit: number
  windowSeconds: number
}

/**
 * Redis key pattern for quota checker keys.
 */
const getBloomKey = (userId: string) => `user:${userId}:bloom`
const getCountKey = (userId: string) => `user:${userId}:count`
const getFirstAccessKey = (userId: string) => `user:${userId}:first_access`

/**
 * Redis based implementation of the quota checker.
 * Uses a bloom filter to efficiently track unique document accesses.
 * See the lua script for detailed algorithm description.
 */
export class QuotaChecker implements IQuotaChecker {
  initialized: boolean
  redisClient: RedisClient
  configuration: QuotaCheckerConfiguration
  quotaCheckScriptSha?: string

  constructor(redisClient: RedisClient, configuration: QuotaCheckerConfiguration) {
    this.redisClient = redisClient
    this.initialized = false
    this.configuration = configuration
  }

  async setup(app: ImpressoApplication, path: string) {
    if (this.initialized) return

    this.quotaCheckScriptSha = await this.redisClient.scriptLoad(quotaCheckScript)
    this.initialized = true
  }

  async check(userId: string, docId: string): Promise<QuotaCheckResult> {
    if (this.quotaCheckScriptSha == null) throw new Error('Quota checker not initialized')

    const currentTimestamp = Math.floor(Date.now() / 1000)

    // Execute the Lua script
    const result = (await this.redisClient.evalSha(this.quotaCheckScriptSha, {
      keys: [getBloomKey(userId), getCountKey(userId), getFirstAccessKey(userId)],
      arguments: [
        docId,
        String(this.configuration.quotaLimit),
        String(currentTimestamp),
        String(this.configuration.windowSeconds),
      ],
    })) as number[]

    // Parse the Lua script response
    const [allowed, count, wasCounted, windowStart, secondsUntilReset] = result

    return {
      allowed: allowed === 1,
      count: Number(count),
      wasCounted: wasCounted === 1,
      windowStart: Number(windowStart),
      secondsUntilReset: Number(secondsUntilReset),
    }
  }

  async getState(userId: string): Promise<QuotaState> {
    if (this.quotaCheckScriptSha == null) throw new Error('Quota checker not initialized')

    const currentTimestamp = Math.floor(Date.now() / 1000)

    // Get the count and first access timestamp
    const countStr = await this.redisClient.get(getCountKey(userId))
    const firstAccessStr = await this.redisClient.get(getFirstAccessKey(userId))

    const count = countStr ? Number(countStr) : 0
    const firstAccess = firstAccessStr ? Number(firstAccessStr) : 0

    // Calculate window state
    let windowStart = firstAccess
    let secondsUntilReset = this.configuration.windowSeconds

    if (firstAccess > 0) {
      const windowAge = currentTimestamp - firstAccess
      if (windowAge < this.configuration.windowSeconds) {
        secondsUntilReset = this.configuration.windowSeconds - windowAge
      } else {
        // Window has expired, reset to current time
        windowStart = currentTimestamp
        secondsUntilReset = this.configuration.windowSeconds
      }
    }

    const percentageUsed =
      this.configuration.quotaLimit > 0 ? Math.round((count / this.configuration.quotaLimit) * 100) : 0

    return {
      currentPosition: count,
      quota: this.configuration.quotaLimit,
      percentageUsed: Math.min(percentageUsed, 100),
      secondsUntilReset,
      windowLengthSeconds: this.configuration.windowSeconds,
    }
  }
}

/**
 * Initializes the quota checker service and attaches it to the app.
 */
export default (app: ImpressoApplication) => {
  // Quota checker is enabled when it's explicitly enabled in the configuration and Redis is available.
  const quotaCheckerConfig = app.get('quotaChecker') as QuotaCheckerConfigFromFile | undefined
  let quotaChecker: IQuotaChecker = new NullQuotaChecker()

  if (quotaCheckerConfig?.enabled) {
    const redisClient = app.service('redisClient').client

    if (redisClient == null) {
      logger.info('Quota checker is disabled because Redis is disabled.')
    } else {
      // Convert windowDays to seconds for internal use
      const configuration: QuotaCheckerConfiguration = {
        quotaLimit: quotaCheckerConfig.quotaLimit,
        windowSeconds: quotaCheckerConfig.windowDays * 24 * 60 * 60,
      }
      quotaChecker = new QuotaChecker(redisClient, configuration)
      logger.info(
        `Quota checker is enabled with a limit of ${configuration.quotaLimit} requests per ${quotaCheckerConfig.windowDays} days.`
      )
    }
  } else {
    logger.info('Quota checker is disabled.')
  }

  // Attach it to the app.
  app.use('quotaChecker', ensureServiceIsFeathersCompatible(quotaChecker), { methods: [] })
  // Mark the service as internal - no external use allowed.
  app.service('quotaChecker').hooks({
    before: {
      all: disallow('external'),
    },
  })
}
