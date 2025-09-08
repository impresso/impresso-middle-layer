import { rateLimit } from '../../hooks/rateLimiter'
import { authenticateAround as authenticate } from '../../hooks/authenticate'
import { redactResponse, redactResponseDataItem, RedactionPolicy, unlessHasPermission } from '../../hooks/redaction'
import { loadYamlFile } from '../../util/yaml'
import { transformResponse, transformResponseDataItem } from '../../hooks/transformation'
import { transformContentItem } from '../../transformers/contentItem'
import { utils, validate, validateEach, queryWithCommonParams, displayQueryParams, REGEX_UID } from '../../hooks/params'
import { filtersToSolrQuery } from '../../hooks/search'
import { SolrMappings } from '../../data/constants'
import { eachFilterValidator } from '../search/search.validators'
import { transformBaseFind } from '../../transformers/base'
import { HookOptions } from '@feathersjs/feathers'
import { ImpressoApplication } from '../../types'
import { inPublicApi, inWebAppApi } from '../../hooks/appMode'
import { ContentItemService, IContentItemService } from './content-items.class'

export const contentItemRedactionPolicyPublicApi = loadYamlFile(
  `${__dirname}/resources/contentItemRedactionPolicy.yml`
) as RedactionPolicy
export const contentItemRedactionPolicyWebApp = loadYamlFile(
  `${__dirname}/resources/contentItemRedactionPolicyWebApp.yml`
) as RedactionPolicy

type OrderBy = 'date' | 'relevance' | 'uid' | 'issue' | 'page' | 'newspaper' | 'hasTextContents' | 'ocrQuality'
type ReverseOrderBy = `-${OrderBy}`
type FullOrderBy = OrderBy | ReverseOrderBy

const OrderByChoices: OrderBy[] = [
  'date',
  'relevance',
  'uid',
  'issue',
  'page',
  'newspaper',
  'hasTextContents',
  'ocrQuality',
]
const FullOrderByChoices: FullOrderBy[] = [...OrderByChoices, ...OrderByChoices.map(o => `-${o}`)] as FullOrderBy[]

export default {
  around: {
    all: [authenticate({ allowUnauthenticated: true }), rateLimit()],
  },
  before: {
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
          defaultValue: '-ocrQuality',
        },
      }),
      validateEach('filters', eachFilterValidator, {
        required: false,
      }),
      filtersToSolrQuery(),
      queryWithCommonParams(),
    ],
  },

  after: {
    find: [
      displayQueryParams(['filters']),
      ...inPublicApi([
        transformResponse(transformBaseFind),
        transformResponseDataItem(transformContentItem),
        redactResponseDataItem(contentItemRedactionPolicyPublicApi, unlessHasPermission('getTranscript')),
      ]),
      ...inWebAppApi([redactResponseDataItem(contentItemRedactionPolicyWebApp, unlessHasPermission('explore'))]),
    ],
    get: [
      ...inPublicApi([
        transformResponse(transformContentItem),
        redactResponse(contentItemRedactionPolicyPublicApi, unlessHasPermission('getTranscript')),
      ]),
      ...inWebAppApi([redactResponse(contentItemRedactionPolicyWebApp, unlessHasPermission('explore'))]),
    ],
  },
} as HookOptions<ImpressoApplication, ContentItemService>
