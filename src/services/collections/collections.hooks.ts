import { HookOptions } from '@feathersjs/feathers'
import { inPublicApi } from '@/hooks/appMode.js'
import { authenticateAround as authenticate } from '@/hooks/authenticate.js'
import { rateLimit } from '@/hooks/rateLimiter.js'
import { transformResponse, transformResponseDataItem } from '@/hooks/transformation.js'
import { transformCollection } from '@/transformers/collection.js'
import { ImpressoApplication } from '@/types.js'
import { ICollectionsService } from '@/services/collections/collections.class.js'

export default {
  around: {
    all: [authenticate({ allowUnauthenticated: true }), rateLimit()],
  },
  after: {
    find: [...inPublicApi([transformResponseDataItem(transformCollection)])],
    get: [...inPublicApi([transformResponse(transformCollection)])],
    create: [...inPublicApi([transformResponse(transformCollection)])],
    patch: [...inPublicApi([transformResponse(transformCollection)])],
  },
} as HookOptions<ImpressoApplication, ICollectionsService>
