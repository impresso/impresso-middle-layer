const debug = require('debug')('impresso/services:search-queries-comparison');
const {
  flatten, values, groupBy,
  uniq, omitBy, isNil,
} = require('lodash');
const {
  getItemsFromSolrResponse,
  getFacetsFromSolrResponse,
  getTotalFromSolrResponse,
} = require('../search/search.extractors');
const { sameTypeFiltersToQuery } = require('../../util/solr');
const { SolrNamespaces } = require('../../solr');

// TODO: Do we need to make it configurable in request?
const DefaultSolrFieldsFilter = ['id', 'pp_plain:[json]', 'lg_s'].join(',');

/**
 * Given comparison request (`https://github.com/impresso/impresso-middle-layer/tree/master/src/services/search-queries-comparison/schema/intersection/post/request.json`),
 * build queries intersection payload for `solrService.findAll`.
 *
 * @param {object} request - comparison request.
 * @return {object} `solrService.findAll` payload.
 */
function intersectionRequestToSolrQuery(request) {
  const {
    order_by: orderBy,
    facets,
    limit,
    skip,
    queries,
  } = request;

  const allFilters = flatten(queries.map(({ filters }) => filters));

  const filtersGroupsByType = values(groupBy(allFilters, 'type'));
  const solrQueries = uniq(filtersGroupsByType
    .map(f => sameTypeFiltersToQuery(f, SolrNamespaces.Search)));

  const q = solrQueries.join(' AND ');
  const fl = DefaultSolrFieldsFilter;

  return omitBy({
    q,
    order_by: orderBy,
    facets,
    limit,
    skip,
    fl,
  }, isNil);
}

class SearchQueriesComparison {
  setup(app) {
    this.solrClient = app.get('solrClient');
    this.articlesService = app.service('articles');

    this.handlers = {
      intersection: this.findIntersectingItemsBetweenQueries.bind(this),
    };
  }

  /**
   * Since there are quite a few query parameters we use
   * "POST" instead of "GET" to avoid running over the URL limit of 2048 characters.
   */
  async create(data, params) {
    const { sanitized: request } = data;
    const { method = '' } = params.query;
    const userInfo = {
      user: params.user,
      authenticated: params.authenticated,
    };

    const handler = this.handlers[method];

    debug(`Executing method "${method}" with request: ${JSON.stringify(request)}`);
    return handler(request, userInfo);
  }

  /**
   * Execute `intersection` search that returns results which match all provided queries.
   * @param {object} request - comparison request
   * @param {object} userInfo - a `{ user, authenticated }` object
   * @return {object} response body
   */
  async findIntersectingItemsBetweenQueries(request, userInfo) {
    const solrQuery = intersectionRequestToSolrQuery(request);
    const response = await this.solrClient.findAll(solrQuery);

    const data = await getItemsFromSolrResponse(response, this.articlesService, userInfo);
    const facets = await getFacetsFromSolrResponse(response);
    const total = getTotalFromSolrResponse(response);

    const { limit, skip } = request;

    return {
      data,
      limit,
      skip,
      total,
      info: {
        responseTime: {
          solr: response.responseHeader.QTime,
        },
        facets,
      },
    };
  }
}

module.exports = {
  SearchQueriesComparison,
  intersectionRequestToSolrQuery,
  DefaultSolrFieldsFilter,
};
