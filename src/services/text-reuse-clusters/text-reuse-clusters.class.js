// @ts-check
// @ts-ignore
const {
  mapValues, groupBy, values, uniq, clone,
} = require('lodash');
const { NotFound } = require('@feathersjs/errors');
const { protobuf } = require('impresso-jscommons');
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
const { sameTypeFiltersToQuery } = require('../../util/solr');
const { SolrNamespaces } = require('../../solr');

function buildResponseClusters(clusters, clusterIdsAndText) {
  const clustersById = mapValues(groupBy(clusters, 'id'), v => v[0]);
  return clusterIdsAndText.map(({ id, text: textSample }) => ({
    cluster: clustersById[id],
    textSample,
  }));
}

const deserializeFilters = serializedFilters => protobuf
  .searchQuery.deserialize(serializedFilters).filters;

function filtersToSolrQueries(filters) {
  const filtersGroupsByType = values(groupBy(filters, 'type'));
  return uniq(filtersGroupsByType
    .map(f => sameTypeFiltersToQuery(f, SolrNamespaces.TextReusePassages)));
}

const OrderByKeyToField = {
  'passages-count': PassageFields.ClusterSize,
};

const withExtraQueryParts = (query, parts) => {
  const updatedQuery = clone(query);
  updatedQuery.q = [query.q].concat(parts).join(' AND ');
  return updatedQuery;
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
      filters: serializedFilters,
    } = params.query;

    let filters = [];
    try {
      filters = serializedFilters ? deserializeFilters(serializedFilters) : [];
    } catch (error) {
      console.warn('Could not deserialize filters', error);
    }
    const filterQueryParts = filtersToSolrQueries(filters);
    const [orderByField, orderByDescending] = parseOrderBy(orderBy, OrderByKeyToField);
    const query = getTextReusePassagesClusterIdsSearchRequestForText(
      text, skip, limit, orderByField, orderByDescending,
    );

    const [clusterIdsAndText, info] = await this.solr
      .get(
        withExtraQueryParts(query, filterQueryParts),
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
