// @ts-check
// @ts-ignore
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
    /** @type {import('../../cachedSolr').CachedSolrClient} */
    this.solr = app.get('cachedSolr');
  }

  async find(params) {
    const {
      text,
      skip = 0,
      limit = 10,
      orderBy,
    } = params.query;

    const [orderByField, orderByDescending] = parseOrderBy(orderBy, OrderByKeyToField);

    const [clusterIdsAndText, info] = await this.solr
      .get(
        getTextReusePassagesClusterIdsSearchRequestForText(
          text, skip, limit, orderByField, orderByDescending,
        ),
        this.solr.namespaces.TextReusePassages,
      )
      .then(response => [
        getClusterIdsAndTextFromPassagesSolrResponse(response),
        getPaginationInfoFromPassagesSolrResponse(response),
      ]);

    const clusters = clusterIdsAndText.length > 0
      ? await this.solr
        .get(
          getTextReuseClustersRequestForIds(clusterIdsAndText.map(({ id }) => id)),
          this.solr.namespaces.TextReuseClusters,
        )
        .then(convertClustersSolrResponseToClusters)
      : [];

    return {
      clusters: buildResponseClusters(clusters, clusterIdsAndText),
      info,
    };
  }

  async get(id) {
    const sampleTextPromise = this.solr
      .get(
        getLatestTextReusePassageForClusterIdRequest(id),
        this.solr.namespaces.TextReusePassages,
      )
      .then(getClusterIdsAndTextFromPassagesSolrResponse);

    const clusterPromise = this.solr
      .get(
        getTextReuseClustersRequestForIds([id]),
        this.solr.namespaces.TextReuseClusters,
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
