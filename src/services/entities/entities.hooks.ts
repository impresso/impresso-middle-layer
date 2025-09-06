import { SolrNamespaces } from '../../solr'
import { authenticateAround as authenticate } from '../../hooks/authenticate'
import { rateLimit } from '../../hooks/rateLimiter'

import { validate, validateEach, queryWithCommonParams, utils } from '../../hooks/params'
import { qToSolrFilter, filtersToSolrQuery } from '../../hooks/search'
import { transformResponseDataItem, transformResponse, renameQueryParameters } from '../../hooks/transformation'
import { transformEntityDetails } from '../../transformers/entity'
import { transformBaseFind } from '../../transformers/base'
import { inPublicApi } from '../../hooks/appMode'

const orderByMap = {
  relevance: 'score ASC',
  '-relevance': 'score DESC',
  name: 'l_s ASC,article_fq_f DESC',
  '-name': 'l_s DESC,article_fq_f DESC',
  count: 'article_fq_f ASC,mention_fq_f ASC',
  '-count': 'article_fq_f DESC,mention_fq_f DESC',
  'count-mentions': 'mention_fq_f ASC,article_fq_f ASC',
  '-count-mentions': 'mention_fq_f DESC,article_fq_f DESC',
}

export const orderByValues = Object.keys(orderByMap)

const findQueryParamsRenamePolicy = {
  term: 'q',
}

const findAndGetParamsHooks = [
  ...inPublicApi([renameQueryParameters(findQueryParamsRenamePolicy)]),
  validate({
    q: {
      required: false,
      min_length: 1,
      max_length: 200,
    },
    resolve: {
      required: false,
      transform: (v: any) => v === 'true' || v === true,
    },
    order_by: utils.orderBy({
      values: orderByMap,
      defaultValue: '-count',
    }),
  }),
  validateEach(
    'filters',
    {
      q: {
        max_length: 200,
        required: false,
      },
      context: {
        choices: ['include', 'exclude'],
        defaultValue: 'include',
      },
      op: {
        choices: ['AND', 'OR'],
        defaultValue: 'OR',
      },
      type: {
        choices: ['string', 'type', 'uid', 'wikidataId'],
        required: true,
        // trasform is required because they shoyd be related to entities namespace.
        // transform: (d) => {
        //   if (d === 'uid') {
        //     return d;
        //   }
        //   return `entity-${d}`;
        // },
      },
    },
    {
      required: false,
    }
  ),
  qToSolrFilter('string'),
  filtersToSolrQuery({
    solrIndexProvider: () => SolrNamespaces.Entities as any,
  }),
  queryWithCommonParams(),
]

export default {
  around: {
    all: [authenticate(), rateLimit()],
  },
  before: {
    all: [],
    find: findAndGetParamsHooks,
    get: findAndGetParamsHooks,
    create: [],
    update: [],
    patch: [],
    remove: [],
  },

  after: {
    all: [],
    find: [...inPublicApi([transformResponse(transformBaseFind), transformResponseDataItem(transformEntityDetails)])],
    get: [...inPublicApi([transformResponse(transformEntityDetails)])],
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
