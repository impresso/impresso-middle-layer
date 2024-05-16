const { mapValues, groupBy } = require('lodash')
const {
  buildConnectedClustersRequest,
  parseConnectedClustersResponse,
  getTextReuseClustersRequestForIds,
  convertClustersSolrResponseToClusters,
  getLatestTextReusePassageForClusterIdRequest,
  getClusterIdsAndTextFromPassagesSolrResponse,
} = require('../../logic/textReuse/solr')

function buildResponseClusters(clusters, clusterIdsAndText) {
  const clustersById = mapValues(groupBy(clusters, 'id'), v => v[0])
  return clusterIdsAndText.map(({ id, text: textSample }) => ({
    cluster: clustersById[id],
    textSample,
  }))
}

/** @returns {{ clusterId: string, offset: number, limit: number }} */
function getArguments(params) {
  const { clusterId, offset = 0, limit = 9 } = params.query
  return { clusterId, offset: parseInt(offset, 10), limit: parseInt(limit, 10) }
}

class TextReuseConnectedClusters {
  constructor(app) {
    /** @type {import('../../cachedSolr').CachedSolrClient} */
    this.solr = app.service('cachedSolr')

    // NOTE: using service to mock while data is not available.
    this.textReuseClustersService = app.service('text-reuse-clusters')
  }

  async find(params) {
    const { clusterId, offset, limit } = getArguments(params)
    const request = buildConnectedClustersRequest(clusterId, limit, offset)
    const { clustersIds, total } = await this.solr
      .post(request, this.solr.namespaces.TextReusePassages)
      .then(parseConnectedClustersResponse)

    if (clustersIds.length === 0) {
      return {
        offset,
        limit,
        total,
        clusters: [],
      }
    }

    const sampleTextsPromise = this.solr
      .get(getLatestTextReusePassageForClusterIdRequest(clustersIds), this.solr.namespaces.TextReusePassages)
      .then(getClusterIdsAndTextFromPassagesSolrResponse)

    const clustersPromise = this.solr
      .get(getTextReuseClustersRequestForIds(clustersIds), this.solr.namespaces.TextReuseClusters)
      .then(convertClustersSolrResponseToClusters)

    const [clusterIdsAndText, clusters] = await Promise.all([sampleTextsPromise, clustersPromise])

    const clusterItems = buildResponseClusters(clusters, clusterIdsAndText)
    return {
      offset,
      limit,
      total,
      clusters: clusterItems,
    }
  }
}

module.exports = {
  TextReuseConnectedClusters,
}
