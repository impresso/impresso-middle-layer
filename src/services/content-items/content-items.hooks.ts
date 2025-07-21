import { rateLimit } from '../../hooks/rateLimiter'
import { authenticateAround as authenticate } from '../../hooks/authenticate'
import {
  redactResponse,
  redactResponseDataItem,
  publicApiTranscriptRedactionCondition,
  webAppExploreRedactionCondition,
  inPublicApi,
  RedactionPolicy,
} from '../../hooks/redaction'
import { loadYamlFile } from '../../util/yaml'
import { transformResponse, transformResponseDataItem } from '../../hooks/transformation'
import { transformContentItem } from '../../transformers/contentItem'
import { utils, validate, validateEach, queryWithCommonParams, displayQueryParams, REGEX_UID } from '../../hooks/params'
import { filtersToSolrQuery } from '../../hooks/search'
import { SolrMappings } from '../../data/constants'
import { eachFilterValidator } from '../search/search.validators'
import { transformBaseFind } from '../../transformers/base'
import { ApplicationHookOptions } from '@feathersjs/feathers'
import { ImpressoApplication } from '../../types'

export const contentItemRedactionPolicy = loadYamlFile(
  `${__dirname}/resources/contentItemRedactionPolicy.yml`
) as RedactionPolicy
export const contentItemRedactionPolicyWebApp = loadYamlFile(
  `${__dirname}/resources/contentItemRedactionPolicyWebApp.yml`
) as RedactionPolicy

type OrderBy = 'date' | 'relevance' | 'uid' | 'issue' | 'page' | 'newspaper' | 'hasTextContents'
type ReverseOrderBy = `-${OrderBy}`
type FullOrderBy = OrderBy | ReverseOrderBy

const OrderByChoices: OrderBy[] = ['date', 'relevance', 'uid', 'issue', 'page', 'newspaper', 'hasTextContents']
const FullOrderByChoices: FullOrderBy[] = [...OrderByChoices, ...OrderByChoices.map(o => `-${o}`)] as FullOrderBy[]

export default {
  around: {
    all: [authenticate({ allowUnauthenticated: true }), rateLimit()],
  },
  before: {
    all: [],
    find: [
      validate({
        order_by: {
          before: (d: string | string[]) => {
            if (typeof d === 'string') {
              return d.split(',')
            }
            return d
          },
          choices: FullOrderByChoices,
          transform: (d: string[]) => utils.toOrderBy(d, SolrMappings.search.orderBy, true),
          after: (d: string | string[]) => {
            if (Array.isArray(d)) {
              return d.join(',')
            }
            return d
          },
        },
      }),
      validateEach('filters', eachFilterValidator, {
        required: false,
      }),
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
      transformResponse(transformBaseFind, inPublicApi),
      transformResponseDataItem(transformContentItem, inPublicApi),
      redactResponseDataItem(contentItemRedactionPolicy, publicApiTranscriptRedactionCondition),
      redactResponseDataItem(contentItemRedactionPolicyWebApp, webAppExploreRedactionCondition),
    ],
    get: [
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
} satisfies ApplicationHookOptions<ImpressoApplication>
