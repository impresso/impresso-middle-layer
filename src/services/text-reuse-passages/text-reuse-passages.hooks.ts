import { ApplicationHookOptions } from '@feathersjs/feathers'
import { authenticateAround as authenticate } from '@/hooks/authenticate.js'
import { decodeJsonQueryParameters, decodePathParameters } from '@/hooks/parameters.js'
import { validate } from '@/hooks/params.js'
import { rateLimit } from '@/hooks/rateLimiter.js'
import { RedactionPolicy, redactResponse, redactResponseDataItem, unlessHasPermission } from '@/hooks/redaction.js'
import { transformResponse, transformResponseDataItem } from '@/hooks/transformation.js'
import { transformBaseFind } from '@/transformers/base.js'
import { transformTextReusePassage } from '@/transformers/textReuse.js'
import { ImpressoApplication } from '@/types.js'
import { parseFilters } from '@/util/queryParameters.js'
import { loadYamlFile } from '@/util/yaml.js'
import { inPublicApi, inWebAppApi } from '@/hooks/appMode.js'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

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
