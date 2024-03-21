const {
  mapValues, groupBy, values, uniq, clone, get,
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
  buildSolrRequestForExtraClusterDetails,
  getFacetsFromExtraClusterDetailsResponse,
  getTimelineResolution,
  buildConnectedClustersCountRequest,
  parseConnectedClustersCountResponse,
} = require('../../logic/textReuse/solr');
const { parseOrderBy } = require('../../util/queryParameters');
const { sameTypeFiltersToQuery } = require('../../util/solr');
const { SolrNamespaces } = require('../../solr');
const Newspaper = require('../../models/newspapers.model');

function buildResponseClusters (clusters, clusterIdsAndText) {
  const clustersById = mapValues(groupBy(clusters, 'id'), v => v[0]);
  return clusterIdsAndText.map(({ id, text: textSample }) => ({
    cluster: clustersById[id],
    textSample,
  }));
}

const deserializeFilters = serializedFilters => protobuf
  .searchQuery.deserialize(serializedFilters).filters;

function filtersToSolrQueries (filters) {
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

async function facetsWithItems (facets) {
  return Promise.all(facets.map(async (facet) => {
    if (facet.type === 'newspaper') {
      return {
        ...facet,
        buckets: await Promise.all(facet.buckets.map(async bucket => ({
          ...bucket,
          item: await Newspaper.getCached(bucket.val),
        }))),
      };
    }
    return facet;
  }));
}

/**
 * Text Reuse Passages index does not have a "country" field. But we can get country
 * from newspaper bucket items and recreate buckets for a virtual "country" facet.
 */
function facetsWithCountry (facets) {
  const newspaperFacet = facets.find(({ type }) => type === 'newspaper');
  if (newspaperFacet == null) return facets;

  const countsByCountry = newspaperFacet.buckets.reduce((counts, bucket) => {
    const countryCodeProperty = get(bucket, 'item.properties', []).find(({ name }) => name === 'countryCode');
    if (countryCodeProperty != null) {
      const countryCount = get(counts, countryCodeProperty.value, 0);
      counts[countryCodeProperty.value] = countryCount + bucket.count;
    }
    return counts;
  }, {});

  const countriesBuckets = Object.entries(countsByCountry).map(([countryCode, count]) => ({
    val: countryCode,
    count,
  }));

  return facets.concat([{
    type: 'country',
    numBuckets: countriesBuckets.length,
    buckets: countriesBuckets,
  }]);
}

class TextReuseClusters {
  constructor (options, app) {
    this.options = options || {};
    /** @type {import('../../cachedSolr').CachedSolrClient} */
    this.solr = app.get('cachedSolr');
  }

  async find (params) {
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

  async get (id, { query = {} }) {
    // @ts-ignore
    const includeDetails = query.includeDetails === true || query.includeDetails === 'true';

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

    const connectedClustersCountPromise = this.solr
      .post(
        buildConnectedClustersCountRequest(id),
        this.solr.namespaces.TextReusePassages,
      )
      .then(parseConnectedClustersCountResponse);

    const [clusterIdsAndText, clusters, connectedClustersCount] = await Promise.all([
      sampleTextPromise, clusterPromise, connectedClustersCountPromise,
    ]);

    const clusterItems = buildResponseClusters(clusters, clusterIdsAndText);

    if (clusterItems.length < 1) throw new NotFound();
    const cluster = clusterItems[0];
    cluster.cluster.connectedClustersCount = connectedClustersCount;

    if (!includeDetails) return cluster;

    // fetch cluster extra details

    const extraClusterDetailsRequest = buildSolrRequestForExtraClusterDetails(
      id, cluster.cluster.timeCoverage,
    );

    const extraClusterDetailsResponse = await this.solr
      .post(extraClusterDetailsRequest, this.solr.namespaces.TextReusePassages);
    const facets = getFacetsFromExtraClusterDetailsResponse(extraClusterDetailsResponse);

    cluster.details = { facets: await facetsWithItems(facets) };

    cluster.details.facets = facetsWithCountry(cluster.details.facets);
    cluster.details.resolution = getTimelineResolution(
      cluster.cluster.timeCoverage.from,
      cluster.cluster.timeCoverage.to,
    );

    return cluster;
  }
}

module.exports = { TextReuseClusters };
