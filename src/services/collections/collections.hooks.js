import { authenticateAround as authenticate } from '../../hooks/authenticate'
import { rateLimit } from '../../hooks/rateLimiter'
import { transformResponseDataItem, transformResponse, renameQueryParameters } from '../../hooks/transformation'
import { inPublicApi } from '../../hooks/redaction'
import { transformCollection } from '../../transformers/collection'
import { transformBaseFind } from '../../transformers/base'

const { queryWithCommonParams, validate, utils, REGEX_UIDS } = require('../../hooks/params')

const { STATUS_PRIVATE, STATUS_PUBLIC } = require('../../models/collections.model')

const findQueryParamsRenamePolicy = {
  term: 'q',
}

module.exports = {
  around: {
    all: [authenticate(), rateLimit()],
  },
  before: {
    all: [],
    find: [
      renameQueryParameters(findQueryParamsRenamePolicy, inPublicApi),
      validate({
        uids: {
          required: false,
          regex: REGEX_UIDS,
          transform: d => (Array.isArray(d) ? d : d.split(',')),
        },
        q: {
          required: false,
          max_length: 500,
          transform: d => utils.toSequelizeLike(d),
        },
        order_by: {
          choices: ['-date', 'date', '-size', 'size'],
          defaultValue: '-date',
          transform: d =>
            utils.translate(d, {
              date: [['date_last_modified', 'ASC']],
              '-date': [['date_last_modified', 'DESC']],
              size: [['count_items', 'ASC']],
              '-size': [['count_items', 'DESC']],
            }),
        },
      }),
      queryWithCommonParams(),
    ],
    get: [],
    create: [
      validate(
        {
          // request must contain a name - from which we will create a UID
          name: {
            required: true,
            min_length: 3,
            max_length: 50,
          },
          // optionally
          description: {
            required: false,
            max_length: 500,
          },
          // optionally
          status: {
            required: false,
            choices: [STATUS_PRIVATE, STATUS_PUBLIC],
            defaultValue: STATUS_PRIVATE,
          },
        },
        'POST'
      ),
    ],
    update: [],
    patch: [
      validate(
        {
          // request must contain a name - from which we will create a UID
          name: {
            required: false,
            min_length: 3,
            max_length: 50,
          },
          description: {
            required: false,
            min_length: 0,
            max_length: 500,
          },
        },
        'POST'
      ),
    ],
    remove: [],
  },

  after: {
    all: [],
    find: [
      transformResponse(transformBaseFind, inPublicApi),
      transformResponseDataItem(transformCollection, inPublicApi),
    ],
    get: [transformResponse(transformCollection, inPublicApi)],
    create: [transformResponse(transformCollection, inPublicApi)],
    update: [],
    patch: [transformResponse(transformCollection, inPublicApi)],
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
