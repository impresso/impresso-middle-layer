import { strict as assert } from 'assert'
import sinon from 'sinon'
import { isLoadingError, retryOnLoadingError } from '@/util/redisRetries.js'

const loadingError = () => new Error('LOADING Dragonfly is loading the dataset in memory')

describe('isLoadingError', () => {
  it('detects a Redis LOADING error', () => {
    assert.equal(isLoadingError(loadingError()), true)
  })

  it('detects a bare LOADING reply', () => {
    assert.equal(isLoadingError(new Error('LOADING Redis is loading the dataset in memory')), true)
  })

  it('rejects unrelated errors', () => {
    assert.equal(isLoadingError(new Error('ECONNREFUSED 127.0.0.1:6379')), false)
    assert.equal(isLoadingError(new Error('NOAUTH Authentication required')), false)
  })
})

describe('retryOnLoadingError', () => {
  let sandbox: sinon.SinonSandbox

  beforeEach(() => {
    sandbox = sinon.createSandbox()
  })

  afterEach(() => {
    sandbox.restore()
  })

  it('returns the result when the operation succeeds immediately', async () => {
    const operation = sandbox.stub().resolves('ok')
    assert.equal(await retryOnLoadingError(operation), 'ok')
    assert.equal(operation.callCount, 1)
  })

  it('retries while the server reports LOADING and returns the first successful result', async () => {
    const clock = sandbox.useFakeTimers()
    const operation = sandbox.stub()
    operation.onFirstCall().rejects(loadingError())
    operation.onSecondCall().rejects(loadingError())
    operation.onThirdCall().resolves('ok')

    const promise = retryOnLoadingError(operation)
    await clock.tickAsync(1000)

    assert.equal(await promise, 'ok')
    assert.equal(operation.callCount, 3)
  })

  it('rethrows non-loading errors without retrying', async () => {
    const operation = sandbox.stub().rejects(new Error('ECONNREFUSED 127.0.0.1:6379'))
    await assert.rejects(retryOnLoadingError(operation), /ECONNREFUSED/)
    assert.equal(operation.callCount, 1)
  })

  it('gives up and rethrows the loading error once the retry window is exhausted', async () => {
    const clock = sandbox.useFakeTimers()
    const operation = sandbox.stub().rejects(loadingError())
    const rejection = assert.rejects(retryOnLoadingError(operation, { maxWaitMs: 300, initialDelayMs: 100 }), /LOADING/)
    await clock.tickAsync(2000)
    await rejection
    assert.ok(operation.callCount > 1)
  })
})
