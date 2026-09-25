import { strict as assert } from 'assert'
import sinon from 'sinon'
import type { RedisClient } from '@/redis.js'
import type { ImpressoApplication } from '@/types.js'
import { QuotaChecker } from '@/services/internal/quotaChecker/redis.js'

const loadingError = () => new Error('LOADING Dragonfly is loading the dataset in memory')

describe('redis quota checker', () => {
  let sandbox: sinon.SinonSandbox
  let scriptLoad: sinon.SinonStub
  let evalSha: sinon.SinonStub
  let redisGet: sinon.SinonStub
  let checker: QuotaChecker

  beforeEach(() => {
    sandbox = sinon.createSandbox()
    scriptLoad = sandbox.stub().resolves('sha')
    evalSha = sandbox.stub()
    redisGet = sandbox.stub()
    const redisClient = { scriptLoad, evalSha, get: redisGet } as unknown as RedisClient
    checker = new QuotaChecker(redisClient, { quotaLimit: 100, windowSeconds: 86400 })
  })

  afterEach(() => {
    sandbox.restore()
  })

  it('loads the script with retry when the server is still loading', async () => {
    const clock = sandbox.useFakeTimers()
    scriptLoad.onFirstCall().rejects(loadingError())
    scriptLoad.onSecondCall().resolves('sha1')

    const setup = checker.setup({} as ImpressoApplication, 'quotaChecker')
    await clock.tickAsync(2000)
    await setup

    assert.equal(checker.quotaCheckScriptSha, 'sha1')
    assert.equal(checker.initialized, true)
  })

  it('parses the script response', async () => {
    checker.quotaCheckScriptSha = 'sha'
    evalSha.resolves([1, 5, 1, 1000, 3600])

    assert.deepEqual(await checker.check('user-1', 'doc-1'), {
      allowed: true,
      count: 5,
      wasCounted: true,
      windowStart: 1000,
      secondsUntilReset: 3600,
    })
  })

  it('retries on LOADING and succeeds once the server is ready', async () => {
    const clock = sandbox.useFakeTimers()
    checker.quotaCheckScriptSha = 'sha'
    evalSha.onFirstCall().rejects(loadingError())
    evalSha.onSecondCall().resolves([0, 1, 1, 0, 86400])

    const promise = checker.check('user-1', 'doc-1')
    await clock.tickAsync(1000)

    assert.deepEqual(await promise, {
      allowed: false,
      count: 1,
      wasCounted: true,
      windowStart: 0,
      secondsUntilReset: 86400,
    })
    assert.equal(evalSha.callCount, 2)
  })

  it('rethrows the loading error once the retry window is exhausted', async () => {
    const clock = sandbox.useFakeTimers()
    checker.quotaCheckScriptSha = 'sha'
    evalSha.rejects(loadingError())

    const rejection = assert.rejects(checker.check('user-1', 'doc-1'), /LOADING/)
    await clock.tickAsync(5000)
    await rejection
    assert.ok(evalSha.callCount > 1)
  })

  it('computes the quota state from stored values', async () => {
    checker.quotaCheckScriptSha = 'sha'
    redisGet.onFirstCall().resolves('42')
    redisGet.onSecondCall().resolves('0')

    assert.deepEqual(await checker.getState('user-1'), {
      currentPosition: 42,
      quota: 100,
      percentageUsed: 42,
      secondsUntilReset: 86400,
      windowLengthSeconds: 86400,
    })
  })
})
