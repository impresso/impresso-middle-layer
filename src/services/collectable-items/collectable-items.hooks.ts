import { HookContext } from '@feathersjs/feathers'
import { authenticateAround as authenticate } from '../../hooks/authenticate'
import { rateLimit } from '../../hooks/rateLimiter'
import { AppServices, ImpressoApplication } from '../../types'

export default {
  around: {
    all: [authenticate({ allowUnauthenticated: true }), rateLimit()],
  },
  after: {
    create: [
      /**
       * Create method returns 202 Accepted with empty body
       */
      (context: HookContext<ImpressoApplication, AppServices>) => {
        if (context.http) {
          context.http.status = 202
        }
        context.result = ''
      },
    ],
  },
}
