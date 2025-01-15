import { authenticateAround as authenticate } from '../../hooks/authenticate'
import { decodeJsonQueryParameters, decodePathParameters } from '../../hooks/parameters'
import { validate } from '../../hooks/params'
import { rateLimit } from '../../hooks/rateLimiter'
import { parseFilters } from '../../util/queryParameters'
import {
  redactResponse,
  redactResponseDataItem,
  webAppExploreRedactionCondition,
  publicApiTranscriptRedactionCondition,
  inPublicApi,
} from '../../hooks/redaction'
import { loadYamlFile } from '../../util/yaml'
import { transformResponseDataItem, transformResponse } from '../../hooks/transformation'
import { transformTextReusePassage } from '../../transformers/textReuse'
import { transformBaseFind } from '../../transformers/base'

export const trPassageRedactionPolicy = loadYamlFile(`${__dirname}/resources/trPassageRedactionPolicy.yml`)

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
  after: {
    get: [
      transformResponse(transformTextReusePassage, inPublicApi),
      redactResponse(trPassageRedactionPolicy, webAppExploreRedactionCondition),
      redactResponse(trPassageRedactionPolicy, publicApiTranscriptRedactionCondition),
    ],
    find: [
      transformResponse(transformBaseFind, inPublicApi),
      transformResponseDataItem(transformTextReusePassage, inPublicApi),
      redactResponseDataItem(trPassageRedactionPolicy, webAppExploreRedactionCondition),
      redactResponseDataItem(trPassageRedactionPolicy, publicApiTranscriptRedactionCondition),
    ],
  },
}
