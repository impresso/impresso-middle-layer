import assert from 'assert'
import app from '@/app.js'
import { IQuotaChecker, QuotaChecker } from '@/services/internal/quotaChecker/redis.js'

/**
 * NODE_ENV=default npm run integration-test -- test/integration/services/quotaChecker.test.ts
 */
describe('Quota Checker Service', () => {
  let quotaChecker: IQuotaChecker
  const SMALL_QUOTA_LIMIT = 3 // For testing
  const SHORT_WINDOW_SECONDS = 10 // For testing window expiration

  before(async () => {
    // Wait for Redis client to be ready
    const redisClientService = app.service('redisClient')
    if (redisClientService) {
      await redisClientService.setup(app, 'redisClient')
    }

    // Override quota checker configuration for testing with small quota and short window
    const testConfig = {
      enabled: true,
      quotaLimit: SMALL_QUOTA_LIMIT,
      windowDays: SHORT_WINDOW_SECONDS / (24 * 60 * 60), // Convert seconds to days
    }
    app.set('quotaChecker', testConfig)

    // Create a new QuotaChecker instance with test configuration
    const redisClient = redisClientService?.client
    if (redisClient) {
      const configuration = {
        quotaLimit: testConfig.quotaLimit,
        windowSeconds: testConfig.windowDays * 24 * 60 * 60,
      }
      const redisQuotaChecker = new QuotaChecker(redisClient, configuration)
      // Initialize the service (load Lua script)
      await redisQuotaChecker.setup(app, 'quotaChecker')
      quotaChecker = redisQuotaChecker
    } else {
      throw new Error('Redis client is not available')
    }
  })

  after(async () => {
    // Clean up Redis keys after tests
    const redisClient = app.service('redisClient').client
    if (redisClient) {
      const keys = await redisClient.keys('user:test-*')
      if (keys.length > 0) {
        await redisClient.del(keys)
      }
    }
  })

  describe('check() method', () => {
    it('should allow access on first document', async () => {
      const result = await quotaChecker.check('test-user-1', 'doc-1')
      assert.strictEqual(result.allowed, true, 'First document should be allowed')
      assert.strictEqual(result.count, 1, 'Count should be 1')
      assert.strictEqual(result.wasCounted, true, 'Document should be marked as counted')
    })

    it('should allow re-access to same document', async () => {
      const userId = 'test-user-2'
      const docId = 'doc-1'

      // First access
      const result1 = await quotaChecker.check(userId, docId)
      assert.strictEqual(result1.allowed, true)
      assert.strictEqual(result1.count, 1)

      // Re-access same document
      const result2 = await quotaChecker.check(userId, docId)
      assert.strictEqual(result2.allowed, true, 'Re-access should be allowed')
      assert.strictEqual(result2.count, 1, 'Count should remain 1 (no increment)')
      assert.strictEqual(result2.wasCounted, false, 'Document should not be marked as counted')
    })

    it('should track multiple unique documents', async () => {
      const userId = 'test-user-3'

      // Access 3 different documents
      const result1 = await quotaChecker.check(userId, 'doc-1')
      assert.strictEqual(result1.count, 1)
      assert.strictEqual(result1.wasCounted, true)

      const result2 = await quotaChecker.check(userId, 'doc-2')
      assert.strictEqual(result2.count, 2)
      assert.strictEqual(result2.wasCounted, true)

      const result3 = await quotaChecker.check(userId, 'doc-3')
      assert.strictEqual(result3.count, 3)
      assert.strictEqual(result3.wasCounted, true)

      // Re-access first document
      const result1Again = await quotaChecker.check(userId, 'doc-1')
      assert.strictEqual(result1Again.count, 3, 'Count should still be 3')
      assert.strictEqual(result1Again.wasCounted, false)
    })

    it('should deny new documents when quota reached', async () => {
      const userId = 'test-user-4'

      // Access documents up to quota
      for (let i = 1; i <= SMALL_QUOTA_LIMIT; i++) {
        const result = await quotaChecker.check(userId, `doc-${i}`)
        assert.strictEqual(result.allowed, true, `Document ${i} should be allowed`)
        assert.strictEqual(result.count, i)
      }

      // Try to access new document when at quota
      const overQuotaResult = await quotaChecker.check(userId, 'doc-over-quota')
      assert.strictEqual(overQuotaResult.allowed, false, 'New document should be denied at quota')
      assert.strictEqual(overQuotaResult.count, SMALL_QUOTA_LIMIT, 'Count should remain at quota')
      assert.strictEqual(overQuotaResult.wasCounted, false, 'Bloom filter treats as new document')
    })

    it('should still allow previously seen docs when at quota', async () => {
      const userId = 'test-user-5'

      // Access documents up to the quota limit
      for (let i = 1; i <= SMALL_QUOTA_LIMIT; i++) {
        await quotaChecker.check(userId, `doc-${i}`)
      }

      // Verify we are at the quota limit
      const state = await quotaChecker.getState(userId)
      assert.strictEqual(state.currentPosition, SMALL_QUOTA_LIMIT, 'Should be at quota before re-accessing')

      // Should be able to re-access doc-1 even when at quota
      const result = await quotaChecker.check(userId, 'doc-1')
      assert.strictEqual(result.allowed, true, 'Previously seen doc should always be allowed, even at quota')
      assert.strictEqual(result.count, SMALL_QUOTA_LIMIT, 'Count should remain the same')
    })

    it('should return window information', async () => {
      const result = await quotaChecker.check('test-user-6', 'doc-1')

      assert.ok(result.windowStart > 0, 'Window start should be set')
      assert.ok(result.secondsUntilReset > 0, 'Seconds until reset should be positive')
      assert.ok(
        result.secondsUntilReset <= 10, // short 10 second window for tests
        'Seconds until reset should be less than window length'
      )
    })
  })

  describe('getState() method', () => {
    it('should return quota state for user with no access', async () => {
      const state = await quotaChecker.getState('test-user-7')

      assert.strictEqual(state.currentPosition, 0, 'Position should be 0')
      assert.strictEqual(state.quota, SMALL_QUOTA_LIMIT, `Quota should be ${SMALL_QUOTA_LIMIT}`)
      assert.strictEqual(state.percentageUsed, 0, 'Percentage should be 0')
      assert.ok(state.windowLengthSeconds > 0, 'Window length should be set')
    })

    it('should return correct state after access', async () => {
      const userId = 'test-user-8'

      // Access 2 documents
      await quotaChecker.check(userId, 'doc-1')
      await quotaChecker.check(userId, 'doc-2')

      const state = await quotaChecker.getState(userId)

      assert.strictEqual(state.currentPosition, 2, 'Position should be 2')
      assert.strictEqual(state.quota, SMALL_QUOTA_LIMIT)
      assert.strictEqual(state.percentageUsed, 67, 'Percentage should be ~67%')
      assert.ok(state.secondsUntilReset > 0, 'Seconds until reset should be positive')
      assert.ok(state.windowLengthSeconds > 0)
    })

    it('should show 100% when at quota', async () => {
      const userId = 'test-user-9'

      // Access documents up to quota limit
      for (let i = 1; i <= SMALL_QUOTA_LIMIT; i++) {
        await quotaChecker.check(userId, `doc-${i}`)
      }

      const state = await quotaChecker.getState(userId)

      assert.strictEqual(state.currentPosition, SMALL_QUOTA_LIMIT)
      assert.strictEqual(state.percentageUsed, 100, 'Should be 100%')
    })

    it('should provide all required state fields', async () => {
      const userId = 'test-user-10'
      await quotaChecker.check(userId, 'doc-1')

      const state = await quotaChecker.getState(userId)

      // Verify all fields are present
      assert.ok('currentPosition' in state)
      assert.ok('quota' in state)
      assert.ok('percentageUsed' in state)
      assert.ok('secondsUntilReset' in state)
      assert.ok('windowLengthSeconds' in state)

      // Verify types
      assert.strictEqual(typeof state.currentPosition, 'number')
      assert.strictEqual(typeof state.quota, 'number')
      assert.strictEqual(typeof state.percentageUsed, 'number')
      assert.strictEqual(typeof state.secondsUntilReset, 'number')
      assert.strictEqual(typeof state.windowLengthSeconds, 'number')
    })
  })

  describe('Window expiration', () => {
    it('should reset quota window after expiration', async function () {
      // This test requires waiting, so increase timeout
      this.timeout(15000)

      const userId = 'test-user-11'

      // Access 2 documents
      const result1 = await quotaChecker.check(userId, 'doc-1')
      await quotaChecker.check(userId, 'doc-2')

      assert.strictEqual(result1.count, 1)
      const firstWindowStart = result1.windowStart

      // Wait for window to expire (test config uses 10 seconds)
      await new Promise(resolve => setTimeout(resolve, 11000))

      // Access a new document after window expiration
      const result3 = await quotaChecker.check(userId, 'doc-3')

      // Should have reset: count should be 1 (new window), not 3
      assert.strictEqual(result3.count, 1, 'Count should reset after window expiration')
      assert.strictEqual(result3.wasCounted, true, 'Document should be counted in new window')
      assert.ok(result3.windowStart >= firstWindowStart, 'Window start should be updated or same')
    })
  })

  describe('Error handling', () => {
    it('should handle invalid user ID gracefully', async () => {
      // Should not throw, just return allowed: true (null quota checker behavior)
      const result = await quotaChecker.check('', 'doc-1')
      assert.ok(result)
      assert.strictEqual(typeof result.allowed, 'boolean')
    })

    it('should handle empty document ID', async () => {
      const result = await quotaChecker.check('test-user-12', '')
      assert.ok(result)
      assert.strictEqual(typeof result.allowed, 'boolean')
    })
  })
})
