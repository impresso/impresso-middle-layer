// @ts-check
// const debug = require('debug')('impresso/services:search-queries-comparison');
const {
  flatten, values, groupBy,
  uniq, omitBy, isNil,
} = require('lodash');
const { BadRequest } = require('@feathersjs/errors')
const { logic: { filter: { mergeFilters } } } = require('impresso-jscommons');
const { SolrMappings } = require('../../data/constants');

/**
 * @typedef {import('./').Response} Response
 * @typedef {import('./').Request} Request
 * @typedef {import('./').FacetRequest} FacetRequest
 * @typedef {import('impresso-jscommons').Filter} Filter
 * @typedef {import('impresso-jscommons').Facet} Facet
 */

const {
  getItemsFromSolrResponse,
  getFacetsFromSolrResponse,
  getTotalFromSolrResponse,
} = require('../search/search.extractors');
const { sameTypeFiltersToQuery, filtersToQueryAndVariables } = require('../../util/solr');
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

/**
 * @param {Filter[]} filters
 * @param {FacetRequest[]} facetsRequests
 * @returns {any}
 */
function createQuery(filters, facetsRequests) {
  const { query, variables } = filtersToQueryAndVariables(filters);

  const facets = facetsRequests.reduce((acc, { type, skip, limit }) => {
    const facet = SolrMappings.search.facets[type];
    if (facet == null) throw new BadRequest(`Unknown facet type: "${type}"`);

    return {
      ...acc,
      [type]: {
        ...facet,
        skip: skip == null ? facet.skip : skip,
        limit: limit == null ? facet.limit : limit,
      },
    };
  }, {});

  return {
    query,
    limit: 0,
    params: { hl: false, ...variables },
    facet: facets,
  };
}

/**
 * @param {any} solrResponse
 * @returns {Promise<Facet[]>}
 */
async function getResponseFacetsFromSolrResponse(solrResponse) {
  const facets = await getFacetsFromSolrResponse(solrResponse);
  return Object.keys(facets)
    .filter(type => typeof facets[type] === 'object')
    .map(type => ({
      ...facets[type],
      type,
    }));
}

class SearchQueriesComparison {
  setup(app) {
    // this.solrClient = app.get('solrClient');
    // this.articlesService = app.service('articles');

    /** @type {import('../../cachedSolr').CachedSolrClient} */
    this.solr = app.get('cachedSolr');

    // this.handlers = {
    //   intersection: this.findIntersectingItemsBetweenQueries.bind(this),
    // };
  }

  /**
   * @param {Request} request
   * @param {{ user: object, authenticated: boolean}} params
   *
   * @returns {Promise<Response>}
   */
  async create(request, params) {
    const userInfo = {
      user: params.user,
      authenticated: !!params.authenticated,
    };

    const intersectionFilters = request.filtersSets
      .reduce((mergedFilters, filters) => mergeFilters(mergedFilters.concat(filters)));

    const intersectionSolrQuery = createQuery(intersectionFilters, request.facets);
    const intersectionFacets = await this.solr
      .post(intersectionSolrQuery, this.solr.namespaces.Search)
      .then(getResponseFacetsFromSolrResponse);

    console.log(intersectionSolrQuery, intersectionFacets, userInfo);

    return {
      facetsSets: request.filtersSets.map(() => request.facets
        .map(({ type }) => ({ type, numBuckets: 0, buckets: [] }))),
      intersectionFacets,
    };
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
