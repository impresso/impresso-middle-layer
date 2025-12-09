import { HookContext, HookOptions } from '@feathersjs/feathers'
import { authenticateAround as authenticate } from '../../hooks/authenticate'
import { rateLimit } from '../../hooks/rateLimiter'
import { ImpressoApplication } from '../../types'
import { ICollectableItemsService } from './collectable-items.class'

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
