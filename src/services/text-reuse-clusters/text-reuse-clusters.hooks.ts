import { ApplicationHookOptions } from '@feathersjs/feathers'
import { inPublicApi, inWebAppApi } from '../../hooks/appMode'
import { authenticateAround as authenticate } from '../../hooks/authenticate'
import { decodeJsonQueryParameters } from '../../hooks/parameters'
import { validate } from '../../hooks/params'
import { rateLimit } from '../../hooks/rateLimiter'
import { RedactionPolicy, redactResponse, redactResponseDataItem, unlessHasPermission } from '../../hooks/redaction'
import {
  renameQueryParameters,
  renameTopLevelField,
  transformResponse,
  transformResponseDataItem,
} from '../../hooks/transformation'
import { transformBaseFind } from '../../transformers/base'
import { transformTextReuseCluster } from '../../transformers/textReuse'
import { ImpressoApplication } from '../../types'
import { parseFilters } from '../../util/queryParameters'
import { loadYamlFile } from '../../util/yaml'

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
          transform: (f: string) => parseFilters(f)[0], // parse a single filter
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
