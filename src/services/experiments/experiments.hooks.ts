import { HookMap } from '@feathersjs/feathers'
import { authenticateAround as authenticate } from '../../hooks/authenticate'
import { rateLimit } from '../../hooks/rateLimiter'
import { AppServices, ImpressoApplication } from '../../types'

export default {
  around: {
    all: [authenticate({ allowUnauthenticated: false }), rateLimit()],
  },
} satisfies HookMap<ImpressoApplication, AppServices>
