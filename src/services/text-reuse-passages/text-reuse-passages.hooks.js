import { decodeJsonQueryParameters, decodePathParameters } from '../../hooks/parameters'
import { validateParameters } from '../../util/openapi'
import { docs } from './text-reuse-passages.schema'

module.exports = {
  before: {
    get: [
      decodePathParameters(['id']), //
      validateParameters(docs.operations.get.parameters), //
    ],
    find: [
      decodeJsonQueryParameters(['filters', 'addons']), //
      validateParameters(docs.operations.find.parameters), //
    ],
  },
}
