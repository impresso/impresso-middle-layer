import { HookOptions } from '@feathersjs/feathers'
import { SolrMappings } from '@/data/constants.js'
import {
  ContextCondtition,
  ImpressoAppHookContext,
  inPublicApi,
  inPublicApiOrWhen,
  inWebAppApi,
} from '@/hooks/appMode.js'
import { authenticateAround as authenticate } from '@/hooks/authenticate.js'
import { displayQueryParams, queryWithCommonParams, utils, validate, validateEach } from '@/hooks/params.js'
import { rateLimit } from '@/hooks/rateLimiter.js'
import {
  RedactionPolicy,
  redactResponse,
  redactResponseDataItem,
  unlessHasPermission,
  unlessHasPermissionAndWithinQuota,
} from '@/hooks/redaction.js'
import { filtersToSolrQuery, termToSolrFilter } from '@/hooks/search.js'
import { transformResponse, transformResponseDataItem } from '@/hooks/transformation.js'
import { transformBaseFind } from '@/transformers/base.js'
import { transformContentItem } from '@/transformers/contentItem.js'
import { ImpressoApplication } from '@/types.js'
import { loadYamlFile } from '@/util/yaml.js'
import { eachFilterValidator } from '@/services/search/search.validators.js'
import { ContentItemService } from '@/services/content-items/content-items.class.js'

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

interface Params {
  order_by?: string | string[]
  include_embeddings?: boolean
  include_transcript?: boolean
  term?: string
}

/**
 * Condition that checks if the request orgiginated from another internal service
 * that wants the public API behavior.
 */
const whenCalledInternallyAsPublicApi: ContextCondtition<ContentItemService> = (
  context: ImpressoAppHookContext<ContentItemService>
) => {
  return context.params.asPublicApi === true
}

export default {
  around: {
    all: [authenticate({ allowUnauthenticated: true }), rateLimit()],
  },
  before: {
    find: [
      validate<Params>({
        order_by: {
          before: d => {
            if (typeof d === 'string') {
              return d.split(',')
            }
            return d
          },
          choices: FullOrderByChoices,
          transform: d => {
            if (d == null) return d
            return utils.toOrderBy(Array.isArray(d) ? d[0] : d, SolrMappings.search.orderBy, true)
          },
          after: d => {
            if (Array.isArray(d)) {
              return d.join(',')
            }
            return d
          },
          defaultValue: '-ocrQuality',
        },
        include_embeddings: {
          required: false,
          defaultValue: 'false',
          transform: d => String(d) === 'true',
        },
        include_transcript: {
          required: false,
          defaultValue: 'false',
          transform: d => String(d) === 'true',
        },
        term: {
          required: false,
          min_length: 1,
          max_length: 200,
        },
      }),
      validateEach('filters', eachFilterValidator, {
        required: false,
      }),
      termToSolrFilter('term'),
      filtersToSolrQuery(),
      queryWithCommonParams(),
    ],
  },

  after: {
    find: [
      displayQueryParams(['filters']),
      ...inPublicApiOrWhen(
        [
          transformResponse(transformBaseFind),
          transformResponseDataItem(transformContentItem),
          // NOTE: Do not check quota in find - transcript is not included
          redactResponseDataItem(
            contentItemRedactionPolicyPublicApi,
            unlessHasPermissionAndWithinQuota('getTranscript')
          ),
        ],
        whenCalledInternallyAsPublicApi
      ),
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
