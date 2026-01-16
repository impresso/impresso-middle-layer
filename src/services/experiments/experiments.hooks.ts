import { HookMap } from '@feathersjs/feathers'
import { authenticateAround as authenticate } from '@/hooks/authenticate.js'
import { rateLimit } from '@/hooks/rateLimiter.js'
import { AppServices, ImpressoApplication } from '@/types.js'

export default {
  around: {
    all: [authenticate({ allowUnauthenticated: false }), rateLimit()],
  },
} satisfies HookMap<ImpressoApplication, AppServices>
