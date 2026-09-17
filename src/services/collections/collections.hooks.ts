import { HookOptions } from '@feathersjs/feathers'
import { inPublicApi } from '@/hooks/appMode.js'
import { authenticateAround as authenticate } from '@/hooks/authenticate.js'
import { queryWithCommonParams, utils, validate } from '@/hooks/params.js'
import { rateLimit } from '@/hooks/rateLimiter.js'
import { transformResponse, transformResponseDataItem } from '@/hooks/transformation.js'
import { transformCollection } from '@/transformers/collection.js'
import { ImpressoApplication } from '@/types.js'
import { CollectionsQuery, ICollectionsService } from '@/services/collections/collections.class.js'

export default {
  around: {
    all: [authenticate({ allowUnauthenticated: true }), rateLimit()],
  },
  before: {
    find: [
      validate<Pick<CollectionsQuery, 'order_by' | 'term'>>(
        {
          order_by: {
            required: false,
            choices: ['-date', 'date'],
            defaultValue: '-date',
            transform: d => {
              if (!d) return undefined
              const value = Array.isArray(d) ? d[0] : d
              return utils.translate(value, {
                '-date': [['lastModifiedDate', 'DESC']],
                date: [['lastModifiedDate', 'ASC']],
              })
            },
          },
          term: {
            required: false,
            min_length: 1,
            max_length: 200,
          },
        },
        'GET',
        { applyInPlace: true }
      ),
      queryWithCommonParams(),
    ],
  },
  after: {
    find: [...inPublicApi([transformResponseDataItem(transformCollection)])],
    get: [...inPublicApi([transformResponse(transformCollection)])],
    create: [...inPublicApi([transformResponse(transformCollection)])],
    patch: [...inPublicApi([transformResponse(transformCollection)])],
  },
} as HookOptions<ImpressoApplication, ICollectionsService>
