import { strict as assert } from 'assert'
import sinon from 'sinon'
import type { RedisClient } from '@/redis.js'
import type { ImpressoApplication } from '@/types.js'
import { getRateLimitPolicy, RateLimiter } from '@/services/internal/rateLimiter/redis.js'

const loadingError = () => new Error('LOADING Dragonfly is loading the dataset in memory')

describe('rate limiter resource policies', () => {
  const configuration = {
    capacity: 10,
    refillRate: 0.016,
    resources: {
      'barista-proxy': {
        capacity: 60,
        refillRate: 1 / 60,
      },
    },
  }

  it('uses a resource-specific policy when configured', () => {
    assert.deepEqual(getRateLimitPolicy(configuration, 'barista-proxy'), configuration.resources['barista-proxy'])
  })

  it('falls back to the default policy for other resources', () => {
    assert.deepEqual(getRateLimitPolicy(configuration, 'search'), {
      capacity: configuration.capacity,
      refillRate: configuration.refillRate,
    })
  })
})

describe('redis rate limiter', () => {
  let sandbox: sinon.SinonSandbox
  let scriptLoad: sinon.SinonStub
  let evalSha: sinon.SinonStub
  let limiter: RateLimiter

  beforeEach(() => {
    sandbox = sinon.createSandbox()
    scriptLoad = sandbox.stub().resolves('sha')
    evalSha = sandbox.stub()
    const redisClient = { scriptLoad, evalSha } as unknown as RedisClient
    limiter = new RateLimiter(redisClient, { capacity: 10, refillRate: 1, enabled: true })
  })

  afterEach(() => {
    sandbox.restore()
  })

  it('loads scripts with retry when the server is still loading', async () => {
    const clock = sandbox.useFakeTimers()
    scriptLoad.onFirstCall().rejects(loadingError())
    scriptLoad.onSecondCall().resolves('sha1')

    const setup = limiter.setup({} as ImpressoApplication, 'rateLimiter')
    await clock.tickAsync(2000)
    await setup

    assert.equal(limiter.rateLimiterScriptSha, 'sha1')
    assert.equal(limiter.rateLimiterRevertScriptSha, 'sha')
    assert.equal(limiter.initialized, true)
  })

  it('returns the used tokens when the server responds', async () => {
    limiter.rateLimiterScriptSha = 'sha'
    evalSha.resolves(3)

    assert.deepEqual(await limiter.allow('user-1', 'search'), {
      usedTokens: 4,
      totalTokens: 10,
      isAllowed: true,
    })
  })

  it('retries on LOADING and returns the result once the server is ready', async () => {
    const clock = sandbox.useFakeTimers()
    limiter.rateLimiterScriptSha = 'sha'
    evalSha.onFirstCall().rejects(loadingError())
    evalSha.onSecondCall().resolves(10)

    const promise = limiter.allow('user-1', 'search')
    await clock.tickAsync(1000)

    assert.deepEqual(await promise, { usedTokens: 11, totalTokens: 10, isAllowed: false })
    assert.equal(evalSha.callCount, 2)
  })

  it('fails open when the server keeps reporting LOADING', async () => {
    const clock = sandbox.useFakeTimers()
    limiter.rateLimiterScriptSha = 'sha'
    evalSha.rejects(loadingError())

    const promise = limiter.allow('user-1', 'search')
    await clock.tickAsync(5000)

    assert.deepEqual(await promise, { usedTokens: 0, totalTokens: 0, isAllowed: true })
  })

  it('fails open without throwing when undo keeps reporting LOADING', async () => {
    const clock = sandbox.useFakeTimers()
    limiter.rateLimiterRevertScriptSha = 'sha'
    evalSha.rejects(loadingError())

    const promise = limiter.undo('user-1', 'search')
    await clock.tickAsync(5000)

    assert.deepEqual(await promise, { usedTokens: 0, totalTokens: 0, isAllowed: true })
  })
})
