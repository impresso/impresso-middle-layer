import { authenticateAround as authenticate } from '../../hooks/authenticate'
import { rateLimit } from '../../hooks/rateLimiter'
import { decodeJsonQueryParameters } from '../../hooks/parameters'

// const { validateWithSchema } = require('../../hooks/schema')

module.exports = {
  around: {
    all: [authenticate({ allowUnauthenticated: true }), rateLimit()],
  },
  before: {
    all: [],
    find: [
      decodeJsonQueryParameters(['filters']), //
    ],
    get: [],
    create: [],
    update: [],
    patch: [],
    remove: [],
  },

  after: {
    all: [],
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
