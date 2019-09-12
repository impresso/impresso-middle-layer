const debug = require('debug')('impresso/services:search-queries-comparison');
const {
  getItemsFromSolrResponse,
  getFacetsFromSolrResponse,
  getTotalFromSolrResponse,
} = require('../search/search.extractors');

function intersectionRequestToSolrQuery(request) {
  const {
    order_by: orderBy,
    facets,
    limit,
    skip,
  } = request;

  const q = 'ucoll_ss:local-eb-5ARSPMJj';
  const fl = 'id,pp_plain:[json],lg_s';


  return {
    q,
    order_by: orderBy,
    facets,
    limit,
    skip,
    fl,
  };
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
   * "POST" instead of "GET".
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
};
