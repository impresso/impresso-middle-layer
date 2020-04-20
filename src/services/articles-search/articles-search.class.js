// @ts-check

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
    console.log(relevanceContext, filters);
    return [];
  }
}

module.exports = {
  ArticlesSearch,
};
