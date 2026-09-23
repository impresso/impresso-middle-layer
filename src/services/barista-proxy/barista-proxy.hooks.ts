import { authenticateAround as authenticate } from '@/hooks/authenticate.js'
import { rateLimit } from '@/hooks/rateLimiter.js'

export const BaristaRateLimitResource = 'barista-proxy'

export default {
  around: {
    all: [authenticate({ allowUnauthenticated: true }), rateLimit(BaristaRateLimitResource)],
  },
}
