// @ts-check
const { statsConfiguration } = require('../../data');
const { filtersToQueryAndVariables } = require('../../util/solr');
const { getWidestInclusiveTimeInterval } = require('../../logic/filters');
const Topic = require('../../models/topics.model');
const Entity = require('../../models/entities.model');
const Newspaper = require('../../models/newspapers.model');

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

const entityCacheExtractor = (key) => {
  const entity = Entity.getCached(key);
  return entity == null ? key : entity.name;
};

const FacetLabelCache = Object.freeze({
  topic: async (key) => {
    const topic = await Topic.getCached(key);
    if (topic == null) return key;
    return topic.words.map(({ w }) => w).join(', ');
  },
  newspaper: async (key) => {
    const newspaper = await Newspaper.getCached(key);
    return newspaper == null
      ? key
      : newspaper.name;
  },
  person: entityCacheExtractor,
  location: entityCacheExtractor,
  language: key => key,
  country: key => key,
  type: key => key,
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

function buildSolrRequest (facet, index, domain, stats, filters) {
  const facetType = getFacetType(index, facet);
  const domainDetails = getDomainDetails(index, domain, filters);

  const { query } = filtersToQueryAndVariables(filters, index);

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

const withLabel = async (val, facet) => {
  const extractor = FacetLabelCache[facet];
  return {
    label: extractor ? await extractor(val) : val,
    value: val,
  };
};

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

async function buildItemsDictionary (items, facet) {
  const terms = new Set(items
    .flatMap(({ value: { items: subitems = [] } }) => subitems)
    .map(({ term }) => term));

  const extractor = FacetLabelCache[facet];
  if (extractor == null) return {};

  return [...terms].reduce(async (accPromise, term) => {
    const acc = await accPromise;
    acc[term] = await extractor(term);
    return acc;
  }, {});
}

const itemsSortFn = (a, b) => {
  if (a.domain < b.domain) return -1;
  if (a.domain > b.domain) return 1;
  return 0;
};

async function buildResponse (result, facet, index, domain, filters) {
  const { domain: { buckets = [] } = {} } = result.facets;
  const facetType = getFacetType(index, facet);
  const resolution = getTemporalResolution(domain, filters);

  const items = (await Promise.all(buckets.map(async ({
    val, ...rest
  }) => ({
    domain: domain === TimeDomain ? parseDate(val, resolution) : await withLabel(val, domain),
    value: parseValue(rest, facetType),
  })))).sort(itemsSortFn);

  return {
    items,
    itemsDictionary: await buildItemsDictionary(items, facet),
    meta: {
      facetType,
      domain,
      resolution,
      filters,
    },
  };
}

class Stats {
  constructor (app) {
    /** @type {import('../../cachedSolr').CachedSolrClient} */
    this.solr = app.get('cachedSolr');
  }

  async find ({
    request: {
      facet, index, domain, stats, filters,
    },
  }) {
    const request = buildSolrRequest(facet, index, domain, stats, filters);
    const result = await this.solr.post(request, index);
    return buildResponse(result, facet, index, domain, filters);
  }
}

module.exports = { Stats };
