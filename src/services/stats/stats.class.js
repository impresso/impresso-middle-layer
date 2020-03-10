// @ts-check
const { statsConfiguration } = require('../../data');
const {
  TimeDomain, StatsToSolrFunction, DefaultStats,
} = require('./common');

const FacetTypes = Object.freeze({
  Term: 'term',
  Numeric: 'numeric',
});

const getFacetType = (index, facet) => {
  const indexFacets = statsConfiguration.indexes[index].facets;
  return Object.keys(indexFacets).find(type => Object.keys(indexFacets[type]).includes(facet));
};

const getFacetQueryPart = (facet, index, type, stats) => {
  const facetDetails = statsConfiguration.indexes[index].facets[type][facet];
  switch (type) {
    case FacetTypes.Numeric:
      return stats.reduce((acc, stat) => {
        acc[stat] = StatsToSolrFunction[stat](facetDetails.field);
        return acc;
      }, {});
    case FacetTypes.Term:
      return {
        items: {
          type: 'terms',
          field: facetDetails.field,
          limit: facetDetails.limit,
        },
      };
    default:
      throw new Error(`Unknown facet type provided: ${type}`);
  }
};

const getDomainDetails = (index, domain) => {
  if (domain === TimeDomain) {
    // TODO: choose other options if time filter is present and time span is short
    return statsConfiguration.indexes[index].facets.temporal.year;
  }
  return statsConfiguration.indexes[index].facets.term[domain];
};

function buildSolrRequest(facet, index, domain, stats) {
  const facetType = getFacetType(index, facet);
  const domainDetails = getDomainDetails(index, domain);

  return {
    q: '*:*',
    rows: 0,
    hl: false,
    'json.facet': JSON.stringify({
      domain: {
        type: 'terms',
        field: domainDetails.field,
        limit: domainDetails.limit,
        facet: getFacetQueryPart(facet, index, facetType, stats),
      },
    }),
  };
}

// TODO: parse other temporal types
const parseDate = val => `${val}-01-01`;

// TODO: enrich with labels
// eslint-disable-next-line no-unused-vars
const withLabel = (val, facet) => ({ label: val, value: val });

const parseValue = (object, facetType) => {
  switch (facetType) {
    case FacetTypes.Numeric:
      return object;
    case FacetTypes.Term:
      return {
        count: object.count,
        items: object.items.buckets.map(({ val: term, count }) => ({
          term,
          count,
        })),
      };
    default:
      throw new Error(`Unknown facet type provided: ${facetType}`);
  }
};

const itemsSortFn = (a, b) => {
  if (a.domain < b.domain) return -1;
  if (a.domain > b.domain) return 1;
  return 0;
};

function buildResponse(result, facet, index, domain) {
  const { buckets } = result.facets.domain;
  const facetType = getFacetType(index, facet);

  const items = buckets.map(({
    val, ...rest
  }) => ({
    domain: domain === TimeDomain ? parseDate(val) : withLabel(val, domain),
    value: parseValue(rest, facetType),
  })).sort(itemsSortFn);

  return {
    items,
    meta: {
      facetType,
      domain,
    },
  };
}

class TemporalStats {
  constructor(app) {
    /** @type {import('../../cachedSolr').CachedSolrClient} */
    this.solr = app.get('cachedSolr');
  }

  async find(params) {
    const {
      facet = '',
      index = 'search',
      domain = 'time',
      stats: statsString = '',
    } = params.query;

    const stats = statsString === ''
      ? DefaultStats
      : statsString.split(',');

    const request = buildSolrRequest(facet, index, domain, stats);
    const result = await this.solr.get(
      request, this.solr.namespaces.Search,
    );

    return buildResponse(result, facet, index, domain);
  }
}

module.exports = { TemporalStats };
