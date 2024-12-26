import { authenticateAround as authenticate } from '../../hooks/authenticate'
import { rateLimit } from '../../hooks/rateLimiter'
import { OrderByChoices } from './newspapers.schema'
import { transformResponseDataItem, transformResponse, renameQueryParameters } from '../../hooks/transformation'
import { inPublicApi } from '../../hooks/redaction'
import { transformNewspaper } from '../../transformers/newspaper'
import { transformBaseFind } from '../../transformers/base'

const { queryWithCommonParams, validate } = require('../../hooks/params')

const findQueryParamsRenamePolicy = {
  term: 'q',
}

module.exports = {
  around: {
    all: [authenticate({ allowUnauthenticated: true }), rateLimit()],
  },
  before: {
    all: [],
    find: [
      renameQueryParameters(findQueryParamsRenamePolicy, inPublicApi),
      validate({
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
    find: [
      transformResponse(transformBaseFind, inPublicApi),
      transformResponseDataItem(transformNewspaper, inPublicApi),
    ],
    get: [transformResponse(transformNewspaper, inPublicApi)],
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
}
