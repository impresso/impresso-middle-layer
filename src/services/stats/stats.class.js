// @ts-check
const debug = require('debug')('impresso/services:stats')
const { statsConfiguration } = require('../../data')
const { filtersToQueryAndVariables } = require('../../util/solr')
const { getWidestInclusiveTimeInterval } = require('../../logic/filters')
const Topic = require('../../models/topics.model')
const Entity = require('../../models/entities.model')
const Newspaper = require('../../models/newspapers.model')

const {
  TimeDomain,
  StatsToSolrFunction,
  SupportedStatistics,
  StatsToSolrStatistics,
} = require('./common')

const FacetTypes = Object.freeze({
  Term: 'term',
  Numeric: 'numeric',
})

const TemporalResolution = Object.freeze({
  Year: 'year',
  Month: 'month',
  Day: 'day',
})

const entityCacheExtractor = (key) => {
  const entity = Entity.getCached(key)
  return entity == null ? key : entity.name
}

const FacetLabelCache = Object.freeze({
  topic: async (key) => {
    const topic = await Topic.getCached(key)
    if (topic == null) return key
    return topic.words.map(({ w }) => w).join(', ')
  },
  newspaper: async (key) => {
    const newspaper = await Newspaper.getCached(key)
    return newspaper == null ? key : newspaper.name
  },
  person: entityCacheExtractor,
  location: entityCacheExtractor,
  language: (key) => key,
  country: (key) => key,
  type: (key) => key,
})

const getFacetType = (index, facet) => {
  const indexFacets = statsConfiguration.indexes[index].facets
  return Object.keys(indexFacets).find((type) =>
    Object.keys(indexFacets[type]).includes(facet)
  )
}

const getFacetQueryPart = (facet, index, type, stats) => {
  const facetDetails = statsConfiguration.indexes[index].facets[type][facet]
  switch (type) {
    case FacetTypes.Numeric:
      return stats.reduce((acc, stat) => {
        acc[stat] = StatsToSolrFunction[stat](facetDetails.field)
        return acc
      }, {})
    case FacetTypes.Term:
      return {
        items: {
          type: 'terms',
          field: facetDetails.field,
          limit: facetDetails.limit,
        },
      }
    default:
      throw new Error(`Unknown facet type provided: ${type}`)
  }
}

const getTemporalResolution = (domain, filters) => {
  if (domain !== TimeDomain) return undefined
  const days = getWidestInclusiveTimeInterval(filters)
  if (!Number.isFinite(days)) return TemporalResolution.Year
  if (days < 6 * 31) return TemporalResolution.Day
  if (days < 5 * 365) return TemporalResolution.Month
  return TemporalResolution.Year
}

const getDomainDetails = (index, domain, filters) => {
  if (domain === TimeDomain) {
    const { date, yearAndMonth, year } =
      statsConfiguration.indexes[index].facets.temporal
    switch (getTemporalResolution(domain, filters)) {
      case TemporalResolution.Day:
        return date
      case TemporalResolution.Month:
        return yearAndMonth
      default:
        return year
    }
  }
  return statsConfiguration.indexes[index].facets.term[domain]
}

function buildSolrRequest(facet, index, domain, stats, filters, sort, groupby) {
  const facetType = getFacetType(index, facet)
  const domainDetails = getDomainDetails(index, domain, filters)

  const { query } = filtersToQueryAndVariables(filters, index)
  // add
  const collapse = groupby
    ? {
        fq: `{!collapse field=${groupby}}`,
      }
    : null

  return {
    query,
    limit: 0,
    params: { hl: false, ...collapse },
    facet: {
      domain: {
        type: 'terms',
        field: domainDetails.field,
        limit: domainDetails.limit,
        sort,
        facet: getFacetQueryPart(facet, index, facetType, stats),
      },
    },
  }
}

const parseDate = (val, resolution) => {
  switch (resolution) {
    case TemporalResolution.Day:
      return val.split('T')[0]
    case TemporalResolution.Month:
      return `${val}-01`
    default:
      return `${val}-01-01`
  }
}

const withLabel = async (val, facet) => {
  const extractor = FacetLabelCache[facet]
  return {
    label: extractor ? await extractor(val) : val,
    value: val,
  }
}

const parseValue = (object, facetType) => {
  switch (facetType) {
    case FacetTypes.Numeric:
      return object
    case FacetTypes.Term:
      return {
        count: object.count,
        items: object.items.buckets.map(({ val: term, count }) => ({
          term,
          count,
        })),
      }
    default:
      throw new Error(`Unknown facet type provided: ${facetType}`)
  }
}

async function buildItemsDictionary(items, facet) {
  const terms = new Set(
    items
      .flatMap(({ value: { items: subitems = [] } }) => subitems)
      .map(({ term }) => term)
  )

  const extractor = FacetLabelCache[facet]
  if (extractor == null) return {}

  return [...terms].reduce(async (accPromise, term) => {
    const acc = await accPromise
    acc[term] = await extractor(term)
    return acc
  }, {})
}

const itemsSortFn = (a, b) => {
  if (a.domain < b.domain) return -1
  if (a.domain > b.domain) return 1
  return 0
}

async function buildResponse(result, facet, index, domain, filters) {
  const { domain: { buckets = [] } = {} } = result.facets
  const facetType = getFacetType(index, facet)
  const resolution = getTemporalResolution(domain, filters)

  const items = (
    await Promise.all(
      buckets.map(async ({ val, ...rest }) => ({
        domain:
          domain === TimeDomain
            ? parseDate(val, resolution)
            : await withLabel(val, domain),
        value: parseValue(rest, facetType),
      }))
    )
  ).sort(itemsSortFn)

  return {
    items,
    itemsDictionary: await buildItemsDictionary(items, facet),
    meta: {
      facetType,
      domain,
      resolution,
      filters,
    },
  }
}

class Stats {
  constructor(app) {
    /** @type {import('../../cachedSolr').CachedSolrClient} */
    this.solr = app.get('cachedSolr')
  }

  /** Get simple stats for a single dimension, always numeric stats */
  async get(id, params) {
    const { index, stats, filters } = params.query
    // get field name from config stats.yml (numeric only)
    const field = statsConfiguration.indexes[index].facets.numeric[id].field
    // transform ["min","max"] in their corresponding solr function to build the query
    // {!min=true+max=true}field
    const statsField = `{!key=statistics ${stats
      .split(',')
      .map((s) => StatsToSolrStatistics[s])
      .join(' ')}}${field}`

    debug(
      '[get] index:',
      index,
      'field:',
      field,
      'stats:',
      stats,
      'n.filters:',
      filters.length,
      'statsField:',
      statsField
    )
    const { query } = filtersToQueryAndVariables(filters, index)
    const result = await this.solr.post(
      {
        query,
        limit: 0,
        params: { hl: false, stats: true, 'stats.field': statsField },
      },
      index
    )
    debug(
      '[get] index:',
      index,
      'stats result',
      result.stats.stats_fields.statistics
    )
    return {
      statistics: result.stats.stats_fields.statistics,
      total: result.response.numFound,
    }
  }

  async find({
    request: { facet, index, domain, stats, filters, sort, groupby },
  }) {
    const request = buildSolrRequest(
      facet,
      index,
      domain,
      stats,
      filters,
      sort,
      groupby
    )
    debug(
      '[find] index:',
      index,
      'groupby:',
      groupby,
      'domain:',
      domain,
      'stats:',
      stats,
      'filters:',
      filters,
      'sort:',
      sort,
      'facet:',
      JSON.stringify(request.facet, null, 2)
    )
    const result = await this.solr.post(request, index)
    debug('stats result', result.facets)
    const response = await buildResponse(result, facet, index, domain, filters)
    debug('stats response', response.query)
    return response
    // return buildResponse(result, facet, index, domain, filters)
  }
}

module.exports = { Stats }
