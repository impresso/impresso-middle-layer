import { HookContext, HookOptions } from '@feathersjs/feathers'
import { authenticateAround as authenticate } from '@/hooks/authenticate.js'
import { rateLimit } from '@/hooks/rateLimiter.js'
import { ImpressoApplication } from '@/types.js'
import { ICollectableItemsService } from './collectable-items.class.js'

export default {
  around: {
    all: [authenticate({ allowUnauthenticated: true }), rateLimit()],
  },
  after: {
    create: [
      /**
       * Create method returns 202 Accepted with empty body
       */
      (context: HookContext<ImpressoApplication, ICollectableItemsService>) => {
        if (context.http) {
          context.http.status = 202
        }
        context.result = ''
      },
    ],
  },
} as HookOptions<ImpressoApplication, ICollectableItemsService>
