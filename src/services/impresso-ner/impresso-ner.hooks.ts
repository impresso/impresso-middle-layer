import { authenticateAround as authenticate } from '@/hooks/authenticate.js'
import { rateLimit } from '@/hooks/rateLimiter.js'

export default {
  around: {
    all: [authenticate({ allowUnauthenticated: false }), rateLimit()],
  },
}
