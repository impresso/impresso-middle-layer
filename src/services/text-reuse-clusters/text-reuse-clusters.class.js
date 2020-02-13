const { mapValues, groupBy } = require('lodash');
const {
  getTextReusePassagesClusterIdsSearchRequestForText,
  getClusterIdsAndTextFromPassagesSolrResponse,
  getTextReuseClustersRequestForIds,
  convertClustersSolrResponseToClusters,
  getPaginationInfoFromPassagesSolrResponse,
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
    const { text, skip = 0, limit = 10 } = params.query;

    const [clusterIdsAndText, info] = await this.solrClient
      .requestGetRaw(
        getTextReusePassagesClusterIdsSearchRequestForText(text, skip, limit),
        SolrNamespaces.TextReusePassages,
      )
      .then(response => [
        getClusterIdsAndTextFromPassagesSolrResponse(response),
        getPaginationInfoFromPassagesSolrResponse(response),
      ]);

    const clusters = clusterIdsAndText.length > 0
      ? await this.solrClient
        .requestGetRaw(
          getTextReuseClustersRequestForIds(clusterIdsAndText.map(({ id }) => id)),
          SolrNamespaces.TextReuseClusters,
        )
        .then(convertClustersSolrResponseToClusters)
      : [];

    return {
      clusters: buildResponseClusters(clusters, clusterIdsAndText),
      info,
    };
  }
}

module.exports = { TextReuseClusters };
