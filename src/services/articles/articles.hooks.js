import { rateLimit } from '../../hooks/rateLimiter'
import { authenticateAround as authenticate } from '../../hooks/authenticate'
import {
  redactResponse,
  redactResponseDataItem,
  publicApiTranscriptRedactionCondition,
  webAppExploreRedactionCondition,
  inPublicApi,
} from '../../hooks/redaction'
import { loadYamlFile } from '../../util/yaml'
import { transformResponse, transformResponseDataItem } from '../../hooks/transformation'
import { transformContentItem } from '../../transformers/contentItem'

const {
  utils,
  protect,
  validate,
  validateEach,
  queryWithCommonParams,
  displayQueryParams,
  REGEX_UID,
} = require('../../hooks/params')
const { filtersToSolrQuery } = require('../../hooks/search')

const { resolveTopics, resolveUserAddons } = require('../../hooks/resolvers/articles.resolvers')
const { obfuscate } = require('../../hooks/access-rights')
const { SolrMappings } = require('../../data/constants')

export const contentItemRedactionPolicy = loadYamlFile(`${__dirname}/resources/contentItemRedactionPolicy.yml`)
export const contentItemRedactionPolicyWebApp = loadYamlFile(
  `${__dirname}/resources/contentItemRedactionPolicyWebApp.yml`
)

export default {
  around: {
    all: [authenticate({ allowUnauthenticated: true }), rateLimit()],
  },
  before: {
    all: [],
    find: [
      validate({
        resolve: {
          required: false,
          choices: ['collection', 'tags'],
        },
        order_by: {
          before: d => {
            if (typeof d === 'string') {
              return d.split(',')
            }
            return d
          },
          choices: ['-date', 'date', '-relevance', 'relevance'],
          transform: d => utils.toOrderBy(d, SolrMappings.search.orderBy, true),
          after: d => {
            if (Array.isArray(d)) {
              return d.join(',')
            }
            return d
          },
        },
      }),
      validateEach(
        'filters',
        {
          type: {
            choices: ['uid', 'issue', 'page', 'newspaper', 'hasTextContents'],
            required: true,
          },
          q: {
            regex: REGEX_UID,
            required: false,
            // we cannot transform since Mustache is render the filters...
            // transform: d => d.split(',')
          },
        },
        {
          required: false,
        }
      ),
      filtersToSolrQuery(),
      queryWithCommonParams(),
    ],
    get: [],
    create: [],
    update: [],
    patch: [],
    remove: [],
  },

  after: {
    all: [],
    find: [
      displayQueryParams(['filters']),
      protect('content'),
      resolveTopics(),
      obfuscate(),
      transformResponseDataItem(transformContentItem, inPublicApi),
      redactResponseDataItem(contentItemRedactionPolicy, publicApiTranscriptRedactionCondition),
      redactResponseDataItem(contentItemRedactionPolicyWebApp, webAppExploreRedactionCondition),
    ],
    get: [
      resolveTopics(),
      resolveUserAddons(),
      obfuscate(),
      transformResponse(transformContentItem, inPublicApi),
      redactResponse(contentItemRedactionPolicy, publicApiTranscriptRedactionCondition),
      redactResponse(contentItemRedactionPolicyWebApp, webAppExploreRedactionCondition),
    ],
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
