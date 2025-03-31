import { authenticateAround as authenticate } from '../../hooks/authenticate'
import { rateLimit } from '../../hooks/rateLimiter'

export default {
  around: {
    all: [authenticate({ allowUnauthenticated: true }), rateLimit()],
  },
}
