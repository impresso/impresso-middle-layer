import { HookOptions } from '@feathersjs/feathers'
import { inPublicApi } from '../../hooks/appMode'
import { authenticateAround as authenticate } from '../../hooks/authenticate'
import { rateLimit } from '../../hooks/rateLimiter'
import { transformResponse, transformResponseDataItem } from '../../hooks/transformation'
import { transformCollection } from '../../transformers/collection.js'
import { ImpressoApplication } from '../../types'
import { ICollectionsService } from './collections.class'

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
