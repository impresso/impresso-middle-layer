const { mapValues, groupBy } = require('lodash');
const { NotFound } = require('@feathersjs/errors');
const {
  getTextReusePassagesClusterIdsSearchRequestForText,
  getClusterIdsAndTextFromPassagesSolrResponse,
  getTextReuseClustersRequestForIds,
  convertClustersSolrResponseToClusters,
  getPaginationInfoFromPassagesSolrResponse,
  getLatestTextReusePassageForClusterIdRequest,
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

  async get(id) {
    const sampleTextPromise = this.solrClient
      .getRaw(
	getLatestTextReusePassageForClusterIdRequest(id),
	SolrNamespaces.TextReusePassages,
      )
      .then(getClusterIdsAndTextFromPassagesSolrResponse);

    const clusterPromise = this.solrClient
      .getRaw(
	getTextReuseClustersRequestForIds([id]),
	SolrNamespaces.TextReuseClusters,
      )
      .then(convertClustersSolrResponseToClusters);

    const [clusterIdsAndText, clusters] = await Promise.all([
      sampleTextPromise, clusterPromise,
    ]);

    const clusterItems = buildResponseClusters(clusters, clusterIdsAndText);

    if (clusterItems.length < 1) throw new NotFound();
    return clusterItems[0];
  }
}

module.exports = { TextReuseClusters };
