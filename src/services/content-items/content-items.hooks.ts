import { HookOptions } from '@feathersjs/feathers'
import { SolrMappings } from '../../data/constants'
import { inPublicApi, inWebAppApi } from '../../hooks/appMode'
import { authenticateAround as authenticate } from '../../hooks/authenticate'
import { displayQueryParams, queryWithCommonParams, utils, validate, validateEach } from '../../hooks/params'
import { rateLimit } from '../../hooks/rateLimiter'
import {
  RedactionPolicy,
  redactResponse,
  redactResponseDataItem,
  unlessHasPermission,
  unlessHasPermissionAndWithinQuota,
} from '../../hooks/redaction'
import { filtersToSolrQuery } from '../../hooks/search'
import { transformResponse, transformResponseDataItem } from '../../hooks/transformation'
import { transformBaseFind } from '../../transformers/base'
import { transformContentItem } from '../../transformers/contentItem'
import { ImpressoApplication } from '../../types'
import { loadYamlFile } from '../../util/yaml'
import { eachFilterValidator } from '../search/search.validators'
import { ContentItemService } from './content-items.class'

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
        // NOTE: Do not check quota in find - transcript is not included
        redactResponseDataItem(contentItemRedactionPolicyPublicApi, unlessHasPermission('getTranscript')),
      ]),
      ...inWebAppApi([redactResponseDataItem(contentItemRedactionPolicyWebApp, unlessHasPermission('explore'))]),
    ],
    get: [
      ...inPublicApi([
        transformResponse(transformContentItem),
        redactResponse(contentItemRedactionPolicyPublicApi, unlessHasPermissionAndWithinQuota('getTranscript', 'uid')),
      ]),
      ...inWebAppApi([redactResponse(contentItemRedactionPolicyWebApp, unlessHasPermission('explore'))]),
    ],
  },
} as HookOptions<ImpressoApplication, ContentItemService>
