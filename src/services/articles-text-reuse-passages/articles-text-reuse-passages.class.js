const { groupBy, mapValues, first } = require('lodash')
const {
  getTextReusePassagesRequestForArticle,
  convertPassagesSolrResponseToPassages,

  getTextReuseClustersRequestForIds,
  convertClustersSolrResponseToClusters,

  PassageFields,
} = require('../../logic/textReuse/solr')

function buildResponse(passages, clusters) {
  const clustersById = mapValues(groupBy(clusters, 'id'), first)
  return {
    passages: passages.map(({ id, clusterId, offsetStart, offsetEnd }) => {
      const { clusterSize, lexicalOverlap, timeCoverage } = clustersById[clusterId]
      return {
        id,
        clusterId,
        lexicalOverlap,
        clusterSize,
        timeCoverage,
        offsetStart,
        offsetEnd,
      }
    }),
  }
}

const MinimalPassageFields = [
  PassageFields.Id,
  PassageFields.ClusterId,
  PassageFields.OffsetStart,
  PassageFields.OffsetEnd,
]

class ArticlesTextReusePassages {
  constructor(options, app) {
    this.options = options || {}
    /** @type {import('../../cachedSolr').CachedSolrClient} */
    this.solr = app.service('cachedSolr')
  }

  async find(params) {
    const { articleId } = params.route

    // 1. Get passages and clusters
    const passages = await this.solr
      .get(
        getTextReusePassagesRequestForArticle(articleId, MinimalPassageFields),
        this.solr.namespaces.TextReusePassages
      )
      .then(convertPassagesSolrResponseToPassages)
    const clusterIds = [...new Set(passages.map(({ clusterId }) => clusterId))]
    // prettier-ignore
    const clusters =
      clusterIds.length > 0
        ? await this.solr
          .get(getTextReuseClustersRequestForIds(clusterIds), this.solr.namespaces.TextReuseClusters)
          .then(convertClustersSolrResponseToClusters)
        : []

    // 2. Construct response
    const response = buildResponse(passages, clusters)

    return response
  }
}

module.exports = {
  ArticlesTextReusePassages,
}
