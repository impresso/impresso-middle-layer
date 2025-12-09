import { HookOptions } from '@feathersjs/feathers'
import { authenticateAround as authenticate } from '../../hooks/authenticate'
import { rateLimit } from '../../hooks/rateLimiter'
import { inPublicApi } from '../../hooks/appMode'
import { transformResponse, transformResponseDataItem } from '../../hooks/transformation'
import { transformDataProvider } from '../../transformers/dataProvider'
import { ImpressoApplication } from '../../types'

export default {
  around: {
    all: [authenticate({ allowUnauthenticated: true }), rateLimit()],
  },
  after: {
    find: [...inPublicApi([transformResponseDataItem(transformDataProvider)])],
    get: [...inPublicApi([transformResponse(transformDataProvider)])],
  },
} as HookOptions<ImpressoApplication, any>
