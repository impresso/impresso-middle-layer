const { protect } = require('@feathersjs/authentication-local').hooks
const { authenticate } = require('../../hooks/authenticate')
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
const { rateLimit, rollbackRateLimit, DefaultResource, addRateLimitingHeader } = require('../../hooks/rateLimiter')

module.exports = {
  before: {
    all: [],
    find: [
      authenticate('jwt', {
        allowUnauthenticated: true,
      }),
      rateLimit(DefaultResource),
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
      authenticate('jwt'),
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
      addRateLimitingHeader,
    ],
    get: [],
    create: [],
    update: [],
    patch: [],
    remove: [],
  },

  error: {
    all: [],
    find: [rollbackRateLimit(DefaultResource)],
    get: [],
    create: [],
    update: [],
    patch: [],
    remove: [],
  },
}
