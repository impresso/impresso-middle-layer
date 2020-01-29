const {
  getTextReusePassagesClusterIdsSearchRequestForText,
  getClusterIdsFromPassagesSolrResponse,
  getTextContentByClusterIdFromPassagesSolrResponse,
  getTextReuseClustersRequestForIds,
  convertClustersSolrResponseToClusters,
} = require('../../logic/textReuse/solr');
const { SolrNamespaces } = require('../../solr');

function buildResponseClusters(clusters, sampleTextByClusterId) {
  return clusters.map(cluster => ({
    cluster,
    textSample: sampleTextByClusterId[cluster.id],
  }));
}

class TextReuseClusters {
  constructor(options, app) {
    this.options = options || {};
    this.solrClient = app.get('solrClient');
  }

  async find(params) {
    const { text } = params.query;

    const [clusterIds, textByClusterId] = await this.solrClient
      .getRaw(
        getTextReusePassagesClusterIdsSearchRequestForText(text),
        SolrNamespaces.TextReusePassages,
      )
      .then(solrResponse => ([
        getClusterIdsFromPassagesSolrResponse(solrResponse),
        getTextContentByClusterIdFromPassagesSolrResponse(solrResponse),
      ]));
    const uniqueClusterIds = [...new Set(clusterIds)];

    const clusters = await this.solrClient
      .getRaw(
        getTextReuseClustersRequestForIds(uniqueClusterIds),
        SolrNamespaces.TextReuseClusters,
      )
      .then(convertClustersSolrResponseToClusters);

    const response = { clusters: buildResponseClusters(clusters, textByClusterId) };
    return response;
  }
}

module.exports = { TextReuseClusters };
