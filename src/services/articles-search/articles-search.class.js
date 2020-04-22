// @ts-check
const {
  relevanceContextItemsToSolrFormula,
  buildSolrQuery,
} = require('./logic');
const { SolrNamespaces } = require('../../solr');
const { filtersToQueryAndVariables } = require('../../util/solr');

/**
 * @typedef {import('impresso-jscommons').Filter} Filter
 * @typedef {import('.').RelevanceContext} RelevanceContext
 */

class ArticlesSearch {
  constructor(options, app) {
    this.options = options || {};
    /** @type {import('../../cachedSolr').CachedSolrClient} */
    this.solr = app.get('cachedSolr');
  }

  /**
   * Return articles that match filters constraints. Articles
   * are sorted by relevance calculated from the context.
   * @param {{ relevanceContext?: RelevanceContext, filters: Filter[] }} payload
   */
  async create({ relevanceContext = {}, filters = [] }) {
    const items = relevanceContext.items == null
      ? []
      : relevanceContext.items;

    const { query } = filtersToQueryAndVariables(filters, SolrNamespaces.Search);
    const relevanceScoreVariable = relevanceContextItemsToSolrFormula(items);

    const solrQuery = buildSolrQuery(query, relevanceScoreVariable);
    console.log('SQ', solrQuery);
    const result = await this.solr.post(solrQuery, SolrNamespaces.Search);
    console.log('SR', result);

    return [];
  }
}

module.exports = {
  ArticlesSearch,
};
