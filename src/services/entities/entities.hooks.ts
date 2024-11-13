import { SolrNamespaces } from '../../solr'
import { authenticateAround as authenticate } from '../../hooks/authenticate'
import { rateLimit } from '../../hooks/rateLimiter'

const { validate, validateEach, queryWithCommonParams, utils } = require('../../hooks/params')
const { qToSolrFilter, filtersToSolrQuery } = require('../../hooks/search')
import { transformResponseDataItem, transformResponse } from '../../hooks/transformation'
import { inPublicApi } from '../../hooks/redaction'
import { transformEntityDetails } from '../../transformers/entity'

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

const findAndGetParamsHooks = [
  validate({
    q: {
      required: false,
      min_length: 1,
      max_length: 200,
    },
    resolve: {
      required: false,
      transform: () => true,
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
    solrIndexProvider: () => SolrNamespaces.Entities,
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
    find: [transformResponseDataItem(transformEntityDetails, inPublicApi)],
    get: [transformResponse(transformEntityDetails, inPublicApi)],
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
