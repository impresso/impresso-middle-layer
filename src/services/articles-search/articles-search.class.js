import { relevanceContextItemsToSolrFormula, buildSolrQuery, withScore } from './logic'
import { SolrNamespaces } from '../../solr'
import { filtersToQueryAndVariables } from '../../util/solr'
import { getItemsFromSolrResponse, getTotalFromSolrResponse } from '../search/search.extractors'

/**
 * @typedef {import('impresso-jscommons').Filter} Filter
 * @typedef {import('.').RelevanceContextItem} RelevanceContextItem
 * @typedef {import('.').Pagination} Pagination
 */

export class ArticlesSearch {
  constructor(options, app) {
    this.options = options || {}
    /** @type {import('../../internalServices/simpleSolr').SimpleSolrClient} */
    this.solr = app.service('simpleSolrClient')
    this.articlesService = app.service('content-items')
  }

  /**
   * Return articles that match filters constraints. Articles
   * are sorted by relevance calculated from the context.
   * @param {{
   *  relevanceContext?: RelevanceContextItem[],
   *  filters: Filter[],
   *  pagination: Pagination
   * }} payload
   */
  async create({ relevanceContext = [], filters = [], pagination = {} }, params) {
    const items = relevanceContext == null ? [] : relevanceContext

    const { query } = filtersToQueryAndVariables(filters, SolrNamespaces.Search)
    const relevanceScoreVariable = relevanceContextItemsToSolrFormula(items)

    const solrQuery = buildSolrQuery(query, relevanceScoreVariable, pagination)

    const result = await this.solr.select(SolrNamespaces.Search, { body: solrQuery })

    const total = getTotalFromSolrResponse(result)

    const userInfo = {
      user: params.user,
      authenticated: params.authenticated,
    }

    const resultItems = await getItemsFromSolrResponse(result, this.articlesService, userInfo)

    return {
      data: resultItems.map(withScore(result)),
      limit: pagination.limit,
      offset: pagination.offset,
      total,
      info: {
        responseTime: {
          solr: result.responseHeader.QTime,
        },
      },
    }
  }
}
