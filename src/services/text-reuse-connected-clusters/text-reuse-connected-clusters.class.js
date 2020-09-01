const {
  mapValues, groupBy,
} = require('lodash');
const {
  buildConnectedClustersRequest,
  parseConnectedClustersResponse,
  getTextReuseClustersRequestForIds,
  convertClustersSolrResponseToClusters,
  getLatestTextReusePassageForClusterIdRequest,
  getClusterIdsAndTextFromPassagesSolrResponse,
} = require('../../logic/textReuse/solr');

function buildResponseClusters(clusters, clusterIdsAndText) {
  const clustersById = mapValues(groupBy(clusters, 'id'), v => v[0]);
  return clusterIdsAndText.map(({ id, text: textSample }) => ({
    cluster: clustersById[id],
    textSample,
  }));
}

class TextReuseConnectedClusters {
  constructor(app) {
    /** @type {import('../../cachedSolr').CachedSolrClient} */
    this.solr = app.get('cachedSolr');

    // NOTE: using service to mock while data is not available.
    this.textReuseClustersService = app.service('text-reuse-clusters');
  }

  async find(params) {
    const { clusterId } = params.query;
    const request = buildConnectedClustersRequest(clusterId);
    const { clustersIds, total } = await this.solr
      .post(request, this.solr.namespaces.TextReusePassages)
      .then(parseConnectedClustersResponse);

    if (clustersIds.length === 0) return [];

    const sampleTextsPromise = this.solr
      .get(
        getLatestTextReusePassageForClusterIdRequest(clustersIds),
        this.solr.namespaces.TextReusePassages,
      )
      .then(getClusterIdsAndTextFromPassagesSolrResponse);

    const clustersPromise = this.solr
      .get(
        getTextReuseClustersRequestForIds(clustersIds),
        this.solr.namespaces.TextReuseClusters,
      )
      .then(convertClustersSolrResponseToClusters);

    const [clusterIdsAndText, clusters] = await Promise.all([
      sampleTextsPromise, clustersPromise,
    ]);

    const clusterItems = buildResponseClusters(clusters, clusterIdsAndText);
    return clusterItems;
  }
}

module.exports = {
  TextReuseConnectedClusters,
};
