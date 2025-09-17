import { authenticateAround as authenticate } from '../../hooks/authenticate'
import { rateLimit } from '../../hooks/rateLimiter'
import { OrderByChoices } from './newspapers.schema'
import { transformResponseDataItem, transformResponse, renameQueryParameters } from '../../hooks/transformation'
import { transformNewspaper } from '../../transformers/newspaper'
import { transformBaseFind } from '../../transformers/base'
import { ImpressoApplication } from '../../types'
import { HookOptions } from '@feathersjs/feathers'
import { inPublicApi } from '../../hooks/appMode'
import { NewspapersService } from './newspapers.class'

const { queryWithCommonParams, validate } = require('../../hooks/params')

const findQueryParamsRenamePolicy = {
  term: 'q',
}

export default {
  around: {
    all: [authenticate({ allowUnauthenticated: true }), rateLimit()],
  },
  before: {
    all: [],
    find: [
      ...inPublicApi([renameQueryParameters(findQueryParamsRenamePolicy)]),
      validate({
        includedOnly: {
          required: false,
          transform: (d: string) => !!d,
        },
        q: {
          required: false,
          max_length: 500,
        },
        faster: {
          required: false,
          transform: (d: string) => !!d,
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
