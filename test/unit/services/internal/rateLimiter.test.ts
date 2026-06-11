import { strict as assert } from 'assert'
import { getRateLimitPolicy } from '@/services/internal/rateLimiter/redis.js'

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
