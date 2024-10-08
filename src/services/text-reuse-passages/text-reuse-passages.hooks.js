import { authenticateAround as authenticate } from '../../hooks/authenticate'
import { decodeJsonQueryParameters, decodePathParameters } from '../../hooks/parameters'
import { validate } from '../../hooks/params'
import { rateLimit } from '../../hooks/rateLimiter'
import { parseFilters } from '../../util/queryParameters'

// import { validateParameters } from '../../util/openapi'
// import { docs } from './text-reuse-passages.schema'

module.exports = {
  around: {
    all: [authenticate({ allowUnauthenticated: true }), rateLimit()],
  },
  before: {
    get: [
      decodePathParameters(['id']), //
      // validateParameters(docs.operations.get.parameters), //
    ],
    find: [
      decodeJsonQueryParameters(['filters', 'addons']), //
      validate({
        filters: {
          required: false,
          transform: parseFilters,
        },
      }),
      // validateParameters(docs.operations.find.parameters), //
    ],
  },
}
