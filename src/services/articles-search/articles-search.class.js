// @ts-check
const {
  relevanceContextItemsToSolrFormula,
  buildSolrQuery,
  withScore,
} = require('./logic');
const { SolrNamespaces } = require('../../solr');
const { filtersToQueryAndVariables } = require('../../util/solr');
const {
  getItemsFromSolrResponse,
  getTotalFromSolrResponse,
} = require('../search/search.extractors');

/**
 * @typedef {import('impresso-jscommons').Filter} Filter
 * @typedef {import('.').RelevanceContext} RelevanceContext
 * @typedef {import('.').Pagination} Pagination
 */

class ArticlesSearch {
  constructor(options, app) {
    this.options = options || {};
    /** @type {import('../../cachedSolr').CachedSolrClient} */
    this.solr = app.get('cachedSolr');
    this.articlesService = app.service('articles');
  }

  /**
   * Return articles that match filters constraints. Articles
   * are sorted by relevance calculated from the context.
   * @param {{
   *  relevanceContext?: RelevanceContext,
   *  filters: Filter[],
   *  pagination: Pagination
   * }} payload
   */
  async create({ relevanceContext = {}, filters = [], pagination = {} }, params) {
    const items = relevanceContext.items == null
      ? []
      : relevanceContext.items;

    const { query } = filtersToQueryAndVariables(filters, SolrNamespaces.Search);
    const relevanceScoreVariable = relevanceContextItemsToSolrFormula(items);

    const solrQuery = buildSolrQuery(query, relevanceScoreVariable, pagination);

    const result = await this.solr.post(solrQuery, SolrNamespaces.Search);

    const total = getTotalFromSolrResponse(result);

    const userInfo = {
      user: params.user,
      authenticated: params.authenticated,
    };

    const resultItems = await getItemsFromSolrResponse(result, this.articlesService, userInfo);

    return {
      data: resultItems.map(withScore(result)),
      limit: pagination.limit,
      skip: pagination.skip,
      total,
      info: {
        responseTime: {
          solr: result.responseHeader.QTime,
        },
      },
    };
  }
}

module.exports = {
  ArticlesSearch,
};
