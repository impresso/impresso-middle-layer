import { authenticateAround as authenticate } from '../../hooks/authenticate'
import { rateLimit } from '../../hooks/rateLimiter'
import {
  redactResponseDataItem,
  inPublicApi,
  publicApiTranscriptRedactionCondition,
  webAppExploreRedactionCondition,
} from '../../hooks/redaction'
import { transformResponseDataItem, transformResponse, renameQueryParameters } from '../../hooks/transformation'
import { transformBaseFind } from '../../transformers/base'
import { transformContentItem } from '../../transformers/contentItem'
import { loadYamlFile } from '../../util/yaml'
import { resolveTopics } from '../../hooks/resolvers/articles.resolvers'

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

const contentItemRedactionPolicy = loadYamlFile(`${__dirname}/../articles/resources/contentItemRedactionPolicy.yml`)
const contentItemRedactionPolicyWebApp = loadYamlFile(
  `${__dirname}/../articles/resources/contentItemRedactionPolicyWebApp.yml`
)

const findQueryParamsRenamePolicy = {
  term: 'q',
}

module.exports = {
  around: {
    find: [authenticate({ allowUnauthenticated: true }), rateLimit()],
    create: [authenticate()],
  },
  before: {
    all: [],
    find: [
      renameQueryParameters(findQueryParamsRenamePolicy, inPublicApi),
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
      resolveTopics(),
      displayQueryParams(['queryComponents', 'filters']),
      transformResponse(transformBaseFind, inPublicApi),
      resolveQueryComponents(),
      transformResponseDataItem(transformContentItem, inPublicApi),
      redactResponseDataItem(contentItemRedactionPolicy, publicApiTranscriptRedactionCondition),
      redactResponseDataItem(contentItemRedactionPolicyWebApp, webAppExploreRedactionCondition),
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
