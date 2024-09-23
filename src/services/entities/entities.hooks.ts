import { SolrNamespaces } from '../../solr'

const { validate, validateEach, queryWithCommonParams, utils } = require('../../hooks/params')
const { qToSolrFilter, filtersToSolrQuery } = require('../../hooks/search')

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

export default {
  before: {
    all: [],
    find: [
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
    ],
    get: [],
    create: [],
    update: [],
    patch: [],
    remove: [],
  },

  after: {
    all: [],
    find: [],
    get: [],
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
