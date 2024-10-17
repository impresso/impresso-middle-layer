import { authenticateAround as authenticate } from '../../hooks/authenticate'
import { rateLimit } from '../../hooks/rateLimiter'
import { redactResponseDataItem, defaultCondition } from '../../hooks/redaction'
import { loadYamlFile } from '../../util/yaml'

const { protect } = require('@feathersjs/authentication-local').hooks
const {
  validate,
  validateEach,
  queryWithCommonParams,
  displayQueryParams,
  REGEX_UID,
  utils,
} = require('../../hooks/params')
const { filtersToSolrQuery, qToSolrFilter } = require('../../hooks/search')
const { resolveQueryComponents, filtersToSolrFacetQuery } = require('../../hooks/search-info')
const { paramsValidator, eachFilterValidator, eachFacetFilterValidator } = require('./search.validators')
const { SolrMappings } = require('../../data/constants')
const { SolrNamespaces } = require('../../solr')

const articleRedactionPolicy = loadYamlFile(`${__dirname}/../articles/resources/articleRedactionPolicy.yml`)

module.exports = {
  around: {
    find: [authenticate({ allowUnauthenticated: true }), rateLimit()],
    create: [authenticate()],
  },
  before: {
    all: [],
    find: [
      validate({
        ...paramsValidator,
        facets: utils.facets({
          values: SolrMappings.search.facets,
        }),
      }),

      validateEach('filters', eachFilterValidator, {
        required: false,
      }),

      // TODO: Deprecated
      validateEach('facet-filters', eachFacetFilterValidator, {
        required: false,
      }),

      filtersToSolrFacetQuery(),

      qToSolrFilter('string'),

      filtersToSolrQuery({
        overrideOrderBy: true,
      }),

      queryWithCommonParams(),
    ],
    get: [],
    create: [
      validate(
        {
          collection_uid: {
            required: true,
            regex: REGEX_UID,
          },
          group_by: {
            required: true,
            choices: ['articles'],
            transform: d => utils.translate(d, SolrMappings.search.groupBy),
          },
          taskname: {
            required: false,
            choices: ['add_to_collection_from_query', 'add_to_collection_from_tr_passages_query'],
            defaultValue: 'add_to_collection_from_query',
          },
          index: {
            required: false,
            choices: [SolrNamespaces.Search, SolrNamespaces.TextReusePassages],
            defaultValue: SolrNamespaces.Search,
          },
        },
        'POST'
      ),
      validateEach('filters', eachFilterValidator, {
        required: true,
        method: 'POST',
      }),
      filtersToSolrQuery({
        prop: 'data',
        overrideOrderBy: false,
        solrIndexProvider: context => context.data.index || SolrNamespaces.Search,
      }),
    ],
    update: [],
    patch: [],
    remove: [],
  },

  after: {
    all: [],
    find: [
      displayQueryParams(['queryComponents', 'filters']),
      resolveQueryComponents(),
      protect('content'),
      redactResponseDataItem(articleRedactionPolicy, defaultCondition),
    ],
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
