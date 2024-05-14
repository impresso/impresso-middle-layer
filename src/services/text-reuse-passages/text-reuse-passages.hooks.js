import { authenticateAround as authenticate } from '../../hooks/authenticate'
import { decodeJsonQueryParameters, decodePathParameters } from '../../hooks/parameters'
import { rateLimit } from '../../hooks/rateLimiter'
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
      // validateParameters(docs.operations.find.parameters), //
    ],
  },
}
