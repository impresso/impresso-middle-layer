import { authenticateAround as authenticate } from '../../hooks/authenticate'
import { rateLimit } from '../../hooks/rateLimiter'
import { decodeJsonQueryParameters } from '../../hooks/parameters'
import { validate } from '../../hooks/params'
import { parseFilters } from '../../util/queryParameters'
import {
  redactResponse,
  redactResponseDataItem,
  webAppExploreRedactionCondition,
  publicApiTranscriptRedactionCondition,
  inPublicApi,
} from '../../hooks/redaction'
import { loadYamlFile } from '../../util/yaml'
import {
  transformResponseDataItem,
  transformResponse,
  renameTopLevelField,
  renameQueryParameters,
} from '../../hooks/transformation'
import { transformTextReuseCluster } from '../../transformers/textReuse'
import { transformBaseFind } from '../../transformers/base'

// const { validateWithSchema } = require('../../hooks/schema')

const trPassageRedactionPolicy = loadYamlFile(`${__dirname}/resources/trClusterRedactionPolicy.yml`)

const findQueryParamsRenamePolicy = {
  term: 'text',
}

module.exports = {
  around: {
    all: [authenticate({ allowUnauthenticated: true }), rateLimit()],
  },
  before: {
    all: [],
    find: [
      renameQueryParameters(findQueryParamsRenamePolicy, inPublicApi),
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
    get: [
      transformResponse(transformTextReuseCluster, inPublicApi),
      redactResponse(trPassageRedactionPolicy, webAppExploreRedactionCondition),
      redactResponse(trPassageRedactionPolicy, publicApiTranscriptRedactionCondition),
    ],
    find: [
      renameTopLevelField(['clusters', 'data'], inPublicApi),
      transformResponse(transformBaseFind, inPublicApi),
      transformResponseDataItem(transformTextReuseCluster, inPublicApi),
      redactResponseDataItem(trPassageRedactionPolicy, webAppExploreRedactionCondition),
      redactResponseDataItem(trPassageRedactionPolicy, publicApiTranscriptRedactionCondition),
    ],
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
