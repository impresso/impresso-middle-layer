import { getToSelect } from '../../util/solr/adapters'
import { mapValues, groupBy } from 'lodash'
import {
  buildConnectedClustersRequest,
  parseConnectedClustersResponse,
  getTextReuseClustersRequestForIds,
  convertClustersSolrResponseToClusters,
  getLatestTextReusePassageForClusterIdRequest,
  getClusterIdsTextAndPermissionsFromPassagesSolrResponse,
} from '../../logic/textReuse/solr'

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
    /** @type {import('../../internalServices/simpleSolr').SimpleSolrClient} */
    this.solr = app.service('simpleSolrClient')

    // NOTE: using service to mock while data is not available.
    this.textReuseClustersService = app.service('text-reuse-clusters')
  }

  async find(params) {
    const { clusterId, offset, limit } = getArguments(params)
    const request = buildConnectedClustersRequest(clusterId, limit, offset)
    const { clustersIds, total } = await this.solr
      .select(this.solr.namespaces.TextReusePassages, { body: request })
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
      .get(
        this.solr.namespaces.TextReusePassages,
        getToSelect(getLatestTextReusePassageForClusterIdRequest(clustersIds))
      )
      .then(getClusterIdsTextAndPermissionsFromPassagesSolrResponse)

    const clustersPromise = this.solr
      .selectOne(this.solr.namespaces.TextReuseClusters, getToSelect(getTextReuseClustersRequestForIds(clustersIds)))
      .then(convertClustersSolrResponseToClusters)

    const [clusterIdsAndTextAndPermissions, clusters] = await Promise.all([sampleTextsPromise, clustersPromise])

    const clusterItems = buildResponseClusters(clusters, clusterIdsAndTextAndPermissions)
    return {
      offset,
      limit,
      total,
      clusters: clusterItems,
    }
  }
}

export { TextReuseConnectedClusters }
