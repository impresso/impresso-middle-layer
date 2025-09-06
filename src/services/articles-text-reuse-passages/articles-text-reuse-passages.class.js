import { getToSelect } from '../../util/solr/adapters'
const { groupBy, mapValues, first } = require('lodash')
const {
  getTextReusePassagesRequestForArticle,
  convertPassagesSolrResponseToPassages,

  getTextReuseClustersRequestForIds,
  convertClustersSolrResponseToClusters,

  PassageFields,
} = require('../../logic/textReuse/solr')
const { SolrNamespaces } = require('../../solr')

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
    /** @type {import('../../internalServices/simpleSolr').SimpleSolrClient} */
    this.solr = app.service('simpleSolrClient')
  }

  async find(params) {
    const { articleId } = params.route

    // 1. Get passages and clusters
    const passages = await this.solr
      .get(
        SolrNamespaces.TextReusePassages,
        getToSelect(getTextReusePassagesRequestForArticle(articleId, MinimalPassageFields))
      )
      .then(convertPassagesSolrResponseToPassages)
    const clusterIds = [...new Set(passages.map(({ clusterId }) => clusterId))]
    // prettier-ignore
    const clusters =
      clusterIds.length > 0
        ? await this.solr
          .selectOne(SolrNamespaces.TextReuseClusters, getToSelect(getTextReuseClustersRequestForIds(clusterIds)))
          .then(convertClustersSolrResponseToClusters)
        : []

    // 2. Construct response
    const response = buildResponse(passages, clusters)

    return response
  }
}

export default {
  ArticlesTextReusePassages,
}
