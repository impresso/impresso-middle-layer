const { mapValues, groupBy } = require('lodash');
const {
  getTextReusePassagesClusterIdsSearchRequestForText,
  getClusterIdsAndTextFromPassagesSolrResponse,
  getTextReuseClustersRequestForIds,
  convertClustersSolrResponseToClusters,
} = require('../../logic/textReuse/solr');
const { SolrNamespaces } = require('../../solr');

function buildResponseClusters(clusters, clusterIdsAndText) {
  const mapping = mapValues(groupBy(clusterIdsAndText, 'id'), v => v[0].text);
  return clusters.map(cluster => ({
    cluster,
    textSample: mapping[cluster.id],
  }));
}

class TextReuseClusters {
  constructor(options, app) {
    this.options = options || {};
    this.solrClient = app.get('solrClient');
  }

  async find(params) {
    const { text } = params.query;

    const clusterIdsAndText = await this.solrClient
      .getRaw(
        getTextReusePassagesClusterIdsSearchRequestForText(text),
        SolrNamespaces.TextReusePassages,
      )
      .then(getClusterIdsAndTextFromPassagesSolrResponse);

    const clusters = await this.solrClient
      .getRaw(
        getTextReuseClustersRequestForIds(clusterIdsAndText.map(({ id }) => id)),
        SolrNamespaces.TextReuseClusters,
      )
      .then(convertClustersSolrResponseToClusters);

    const response = { clusters: buildResponseClusters(clusters, clusterIdsAndText) };
    return response;
  }
}

module.exports = { TextReuseClusters };
