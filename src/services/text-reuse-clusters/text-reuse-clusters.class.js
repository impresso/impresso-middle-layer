const { mapValues, groupBy } = require('lodash');
const { NotFound } = require('@feathersjs/errors');
const {
  getTextReusePassagesClusterIdsSearchRequestForText,
  getClusterIdsAndTextFromPassagesSolrResponse,
  getTextReuseClustersRequestForIds,
  convertClustersSolrResponseToClusters,
  getPaginationInfoFromPassagesSolrResponse,
  getLatestTextReusePassageForClusterIdRequest,
  PassageFields,
} = require('../../logic/textReuse/solr');
const { SolrNamespaces } = require('../../solr');
const { parseOrderBy } = require('../../util/queryParameters');

function buildResponseClusters(clusters, clusterIdsAndText) {
  const clustersById = mapValues(groupBy(clusters, 'id'), v => v[0]);
  return clusterIdsAndText.map(({ id, text: textSample }) => ({
    cluster: clustersById[id],
    textSample,
  }));
}

const OrderByKeyToField = {
  'passages-count': PassageFields.ClusterSize,
};

class TextReuseClusters {
  constructor(options, app) {
    this.options = options || {};
    this.solrClient = app.get('solrClient');
  }

  async find(params) {
    const {
      text,
      skip = 0,
      limit = 10,
      orderBy,
    } = params.query;

    const [orderByField, orderByDescending] = parseOrderBy(orderBy, OrderByKeyToField);

    const [clusterIdsAndText, info] = await this.solrClient
      .requestGetRaw(
	getTextReusePassagesClusterIdsSearchRequestForText(
	  text, skip, limit, orderByField, orderByDescending,
	),
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
