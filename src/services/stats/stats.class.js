// @ts-check
const { statsConfiguration } = require('../../data');
const { filtersToQueryAndVariables } = require('../../util/solr');
const { getWidestInclusiveTimeInterval } = require('../../logic/filters');
const {
  TimeDomain, StatsToSolrFunction,
} = require('./common');

const FacetTypes = Object.freeze({
  Term: 'term',
  Numeric: 'numeric',
});

const TemporalResolution = Object.freeze({
  Year: 'year',
  Month: 'month',
  Day: 'day',
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

const getTemporalResolution = (domain, filters) => {
  if (domain !== TimeDomain) return undefined;
  const days = getWidestInclusiveTimeInterval(filters);
  if (!Number.isFinite(days)) return TemporalResolution.Year;
  if (days < 6 * 31) return TemporalResolution.Day;
  if (days < 5 * 365) return TemporalResolution.Month;
  return TemporalResolution.Year;
};

const getDomainDetails = (index, domain, filters) => {
  if (domain === TimeDomain) {
    const { date, yearAndMonth, year } = statsConfiguration.indexes[index].facets.temporal;
    switch (getTemporalResolution(domain, filters)) {
      case TemporalResolution.Day:
        return date;
      case TemporalResolution.Month:
        return yearAndMonth;
      default:
        return year;
    }
  }
  return statsConfiguration.indexes[index].facets.term[domain];
};

function buildSolrRequest(facet, index, domain, stats, filters) {
  const facetType = getFacetType(index, facet);
  const domainDetails = getDomainDetails(index, domain, filters);

  const { query } = filtersToQueryAndVariables(filters);

  return {
    query,
    limit: 0,
    params: { hl: false },
    facet: {
      domain: {
        type: 'terms',
        field: domainDetails.field,
        limit: domainDetails.limit,
        facet: getFacetQueryPart(facet, index, facetType, stats),
      },
    },
  };
}

const parseDate = (val, resolution) => {
  switch (resolution) {
    case TemporalResolution.Day:
      return val.split('T')[0];
    case TemporalResolution.Month:
      return `${val}-01`;
    default:
      return `${val}-01-01`;
  }
};

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

function buildResponse(result, facet, index, domain, filters) {
  const { buckets } = result.facets.domain;
  const facetType = getFacetType(index, facet);
  const resolution = getTemporalResolution(domain, filters);

  const items = buckets.map(({
    val, ...rest
  }) => ({
    domain: domain === TimeDomain ? parseDate(val, resolution) : withLabel(val, domain),
    value: parseValue(rest, facetType),
  })).sort(itemsSortFn);

  return {
    items,
    meta: {
      facetType,
      domain,
      resolution,
    },
  };
}

class TemporalStats {
  constructor(app) {
    /** @type {import('../../cachedSolr').CachedSolrClient} */
    this.solr = app.get('cachedSolr');
  }

  async find({
    request: {
      facet, index, domain, stats, filters,
    },
  }) {
    const request = buildSolrRequest(facet, index, domain, stats, filters);
    const result = await this.solr.post(
      request, this.solr.namespaces.Search,
    );

    return buildResponse(result, facet, index, domain, filters);
  }
}

module.exports = { TemporalStats };
