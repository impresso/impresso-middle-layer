import { authenticateAround as authenticate } from '@/hooks/authenticate.js'
import { rateLimit } from '@/hooks/rateLimiter.js'
import { OrderByChoices } from '@/services/newspapers/newspapers.schema.js'
import { transformResponseDataItem, transformResponse, renameQueryParameters } from '@/hooks/transformation.js'
import { transformNewspaper } from '@/transformers/newspaper.js'
import { transformBaseFind } from '@/transformers/base.js'
import { ImpressoApplication } from '@/types.js'
import { HookOptions } from '@feathersjs/feathers'
import { inPublicApi } from '@/hooks/appMode.js'
import { NewspapersService } from '@/services/newspapers/newspapers.class.js'

import { queryWithCommonParams, validate } from '@/hooks/params.js'

const findQueryParamsRenamePolicy = {
  term: 'q',
}

interface Params {
  includedOnly?: boolean
  q?: string
  faster?: boolean
  order_by?: string
}

export default {
  around: {
    all: [authenticate({ allowUnauthenticated: true }), rateLimit()],
  },
  before: {
    all: [],
    find: [
      ...inPublicApi([renameQueryParameters(findQueryParamsRenamePolicy)]),
      validate<Params>({
        includedOnly: {
          required: false,
          transform: d => !!d,
        },
        q: {
          required: false,
          max_length: 500,
        },
        faster: {
          required: false,
          transform: d => !!d,
        },
        order_by: {
          choices: OrderByChoices,
          defaultValue: 'name',
        },
      }),
      queryWithCommonParams(),
    ],
    get: [],
    create: [],
    update: [],
    patch: [],
    remove: [],
  },

  after: {
    find: [...inPublicApi([transformResponse(transformBaseFind), transformResponseDataItem(transformNewspaper)])],
    get: [...inPublicApi([transformResponse(transformNewspaper)])],
    create: [],
    update: [],
    patch: [],
    remove: [],
  },

  error: {
    all: [],
    find: [],
    get: [],
    create: [],
    update: [],
    patch: [],
    remove: [],
  },
} as HookOptions<ImpressoApplication, NewspapersService>
