import { ApplicationHookOptions } from '@feathersjs/feathers'
import { authenticateAround as authenticate } from '../../hooks/authenticate'
import { decodeJsonQueryParameters, decodePathParameters } from '../../hooks/parameters'
import { validate } from '../../hooks/params'
import { rateLimit } from '../../hooks/rateLimiter'
import { RedactionPolicy, redactResponse, redactResponseDataItem, unlessHasPermission } from '../../hooks/redaction'
import { transformResponse, transformResponseDataItem } from '../../hooks/transformation'
import { transformBaseFind } from '../../transformers/base'
import { transformTextReusePassage } from '../../transformers/textReuse'
import { ImpressoApplication } from '../../types'
import { parseFilters } from '../../util/queryParameters'
import { loadYamlFile } from '../../util/yaml'
import { inPublicApi, inWebAppApi } from '../../hooks/appMode'

export const trPassageRedactionPolicy: RedactionPolicy = loadYamlFile(
  `${__dirname}/resources/trPassageRedactionPolicy.yml`
)

// import { validateParameters } from '../../util/openapi'
// import { docs } from './text-reuse-passages.schema'

export default {
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
      ...inPublicApi([
        transformResponse(transformTextReusePassage),
        redactResponse(trPassageRedactionPolicy, unlessHasPermission('getTranscript')),
      ]),
      ...inWebAppApi([redactResponse(trPassageRedactionPolicy, unlessHasPermission('explore'))]),
    ],
    find: [
      ...inPublicApi([
        transformResponse(transformBaseFind),
        transformResponseDataItem(transformTextReusePassage),
        redactResponseDataItem(trPassageRedactionPolicy, unlessHasPermission('getTranscript')),
      ]),
      ...inWebAppApi([redactResponseDataItem(trPassageRedactionPolicy, unlessHasPermission('explore'))]),
    ],
  },
} satisfies ApplicationHookOptions<ImpressoApplication>
