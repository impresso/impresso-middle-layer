import { authenticateAround as authenticate } from '../../hooks/authenticate'
import { rateLimit } from '../../hooks/rateLimiter'
import { decodeJsonQueryParameters } from '../../hooks/parameters'
import { validate } from '../../hooks/params'
import { parseFilters } from '../../util/queryParameters'
import { redactResponse, redactResponseDataItem, defaultCondition } from '../../hooks/redaction'
import { loadYamlFile } from '../../util/yaml'

// const { validateWithSchema } = require('../../hooks/schema')

const trPassageRedactionPolicy = loadYamlFile(`${__dirname}/resources/trClusterRedactionPolicy.yml`)

module.exports = {
  around: {
    all: [authenticate({ allowUnauthenticated: true }), rateLimit()],
  },
  before: {
    all: [],
    find: [
      decodeJsonQueryParameters(['filters']), //
      validate({
        filters: {
          required: false,
          transform: f => parseFilters(f)[0], // parse a single filter
        },
      }),
    ],
    get: [],
    create: [],
    update: [],
    patch: [],
    remove: [],
  },

  after: {
    all: [],
    get: [redactResponse(trPassageRedactionPolicy, defaultCondition)],
    find: [redactResponseDataItem(trPassageRedactionPolicy, defaultCondition, 'clusters')],
    // find: [validateWithSchema('services/text-reuse-clusters/schema/find/response.json', 'result')],
    // get: [validateWithSchema('services/text-reuse-clusters/schema/get/response.json', 'result')],
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
