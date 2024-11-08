import { authenticateAround as authenticate } from '../../hooks/authenticate'
import { rateLimit } from '../../hooks/rateLimiter'
import { OrderByChoices } from './newspapers.schema'
import { transformResponseDataItem } from '../../hooks/transformation'
import { inPublicApi } from '../../hooks/redaction'
import { transformNewspaper } from '../../transformers/newspaper'

const { queryWithCommonParams, validate, utils } = require('../../hooks/params')
const { checkCachedContents, returnCachedContents, saveResultsInCache } = require('../../hooks/redis')

module.exports = {
  around: {
    all: [authenticate({ allowUnauthenticated: true }), rateLimit()],
  },
  before: {
    all: [
      checkCachedContents({
        useAuthenticatedUser: false,
      }),
    ],
    find: [
      validate({
        includedOnly: {
          required: false,
          transform: d => !!d,
        },
        q: {
          required: false,
          max_length: 500,
          transform: d => {
            if (d) {
              return utils.toSequelizeLike(d)
            }
            return null
          },
        },
        faster: {
          required: false,
          transform: d => !!d,
        },
        order_by: {
          choices: OrderByChoices,
          defaultValue: 'name',
          transform: d =>
            utils.translate(d, {
              name: [['id', 'ASC']],
              '-name': [['id', 'DESC']],
              startYear: [['startYear', 'ASC']],
              '-startYear': [['startYear', 'DESC']],
              endYear: [['endYear', 'ASC']],
              '-endYear': [['endYear', 'DESC']],
              firstIssue: [['stats', 'startYear', 'ASC']],
              '-firstIssue': [['stats', 'startYear', 'DESC']],
              lastIssue: [['stats', 'endYear', 'ASC']],
              '-lastIssue': [['stats', 'endYear', 'DESC']],
              countIssues: [['stats', 'number_issues', 'ASC']],
              '-countIssues': [['stats', 'number_issues', 'DESC']],
            }),
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
    all: [returnCachedContents(), saveResultsInCache()],
    find: [transformResponseDataItem(transformNewspaper, inPublicApi)],
    get: [],
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
