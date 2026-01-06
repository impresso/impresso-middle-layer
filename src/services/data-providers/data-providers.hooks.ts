import { HookOptions } from '@feathersjs/feathers'
import { authenticateAround as authenticate } from '@/hooks/authenticate.js'
import { rateLimit } from '@/hooks/rateLimiter.js'
import { inPublicApi } from '@/hooks/appMode.js'
import { transformResponse, transformResponseDataItem } from '@/hooks/transformation.js'
import { transformDataProvider } from '@/transformers/dataProvider.js'
import { ImpressoApplication } from '@/types.js'

export default {
  around: {
    all: [authenticate({ allowUnauthenticated: true }), rateLimit()],
  },
  after: {
    find: [...inPublicApi([transformResponseDataItem(transformDataProvider)])],
    get: [...inPublicApi([transformResponse(transformDataProvider)])],
  },
} as HookOptions<ImpressoApplication, any>
