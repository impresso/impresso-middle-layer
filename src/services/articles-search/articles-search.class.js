import { relevanceContextItemsToSolrFormula, buildSolrQuery, withScore } from './logic.js'
import { SolrNamespaces } from '@/solr.js'
import { buildSolrQuery as buildFiltersSolrQuery } from '@/util/solr/queryBuilder.js'
import { getItemsFromSolrResponse, getTotalFromSolrResponse } from '@/services/search/search.extractors.js'

/**
 * @deprecated - only used for article recommendations in the web app. Remove once replaced.
 * @typedef {import('impresso-jscommons').Filter} Filter
 * @typedef {import('.').RelevanceContextItem} RelevanceContextItem
 * @typedef {import('.').Pagination} Pagination
 */

export class ArticlesSearch {
  constructor(options, app) {
    this.options = options || {}
    this.app = app
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

    const { query, filter } = buildFiltersSolrQuery(
      filters,
      SolrNamespaces.Search,
      this.app.get('solrConfiguration').namespaces ?? [],
      this.app.get('features') ?? {}
    )
    const relevanceScoreVariable = relevanceContextItemsToSolrFormula(items)

    const solrQuery = buildSolrQuery(query, filter, relevanceScoreVariable, pagination)

    const result = await this.solr.select(SolrNamespaces.Search, { body: solrQuery })

    const total = getTotalFromSolrResponse(result)

    const userInfo = {
      user: params.user,
      authenticated: params.authenticated,
    }

    const resultItems = await getItemsFromSolrResponse(result, this.articlesService, userInfo, [], {})

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
