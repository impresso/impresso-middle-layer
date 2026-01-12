import { ApplicationHookOptions } from '@feathersjs/feathers'
import { inPublicApi, inWebAppApi } from '@/hooks/appMode.js'
import { authenticateAround as authenticate } from '@/hooks/authenticate.js'
import { decodeJsonQueryParameters } from '@/hooks/parameters.js'
import { validate } from '@/hooks/params.js'
import { rateLimit } from '@/hooks/rateLimiter.js'
import { RedactionPolicy, redactResponse, redactResponseDataItem, unlessHasPermission } from '@/hooks/redaction.js'
import {
  renameQueryParameters,
  renameTopLevelField,
  transformResponse,
  transformResponseDataItem,
} from '@/hooks/transformation.js'
import { transformBaseFind } from '@/transformers/base.js'
import { transformTextReuseCluster } from '@/transformers/textReuse.js'
import { ImpressoApplication } from '@/types.js'
import { parseFilters } from '@/util/queryParameters.js'
import { loadYamlFile } from '@/util/yaml.js'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const trPassageRedactionPolicy: RedactionPolicy = loadYamlFile(`${__dirname}/resources/trClusterRedactionPolicy.yml`)

const findQueryParamsRenamePolicy = {
  term: 'text',
}

export default {
  around: {
    all: [authenticate({ allowUnauthenticated: true }), rateLimit()],
  },
  before: {
    find: [
      ...inPublicApi([renameQueryParameters(findQueryParamsRenamePolicy)]),
      decodeJsonQueryParameters(['filters']), //
      validate({
        filters: {
          required: false,
          transform: parseFilters,
        },
      }),
    ],
  },

  after: {
    get: [
      ...inPublicApi([
        transformResponse(transformTextReuseCluster),
        redactResponse(trPassageRedactionPolicy, unlessHasPermission('getTranscript')),
      ]),
      ...inWebAppApi([redactResponse(trPassageRedactionPolicy, unlessHasPermission('explore'))]),
    ],
    find: [
      ...inPublicApi([
        renameTopLevelField(['clusters', 'data']),
        transformResponse(transformBaseFind),
        transformResponseDataItem(transformTextReuseCluster),
        redactResponseDataItem(trPassageRedactionPolicy, unlessHasPermission('getTranscript')),
      ]),
      ...inWebAppApi([redactResponseDataItem(trPassageRedactionPolicy, unlessHasPermission('explore'))]),
    ],
    // find: [validateWithSchema('services/text-reuse-clusters/schema/find/response.json', 'result')],
    // get: [validateWithSchema('services/text-reuse-clusters/schema/get/response.json', 'result')],
  },
} satisfies ApplicationHookOptions<ImpressoApplication>
