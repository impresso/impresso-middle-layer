import Debug from 'debug'
import { ImpressoApplication } from '../../types'
import { Id, Params } from '@feathersjs/feathers'
import { SelectRequestBody, SimpleSolrClient } from '../../internalServices/simpleSolr'
import { buildResolvers } from '../../internalServices/cachedResolvers'
const { statsConfiguration } = require('../../data')
const { filtersToQueryAndVariables } = require('../../util/solr')
const { getWidestInclusiveTimeInterval } = require('../../logic/filters')

const { TimeDomain, StatsToSolrFunction, StatsToSolrStatistics } = require('./common')

const debug = Debug('impresso/services:stats')

const FacetTypes = Object.freeze({
  Term: 'term',
  Numeric: 'numeric',
})

const TemporalResolution = Object.freeze({
  Year: 'year',
  Month: 'month',
  Day: 'day',
})

type FacetLabel = 'topic' | 'newspaper' | 'person' | 'location' | 'language' | 'country' | 'type'
type LabelExtractor = (id: string) => Promise<string>

const getFacetLabelCache = (app: ImpressoApplication): Record<FacetLabel, LabelExtractor> => {
  const resolvers = buildResolvers(app)
  return {
    topic: async (key: string) => {
      const topic = await resolvers.topic(key)
      if (topic == null) return key
      return topic.words.map(({ w }: any) => w).join(', ')
    },
    newspaper: async (key: string) => {
      const newspaper = await resolvers.newspaper(key)
      return newspaper == null ? key : newspaper.name
    },
    person: async (key: string) => {
      const entity = await resolvers.person(key)
      return entity == null ? key : entity.name
    },
    location: async (key: string) => {
      const entity = await resolvers.location(key)
      return entity == null ? key : entity.name
    },
    language: async (key: string) => key,
    country: async (key: string) => key,
    type: async (key: string) => key,
  }
}

const getFacetType = (index: string, facet: any) => {
  const indexFacets = statsConfiguration.indexes[index].facets
  return Object.keys(indexFacets).find(type => Object.keys(indexFacets[type]).includes(facet))
}

const getFacetQueryPart = (facet: any, index: string, type: any, stats: any) => {
  const facetDetails = statsConfiguration.indexes[index].facets[type][facet]
  switch (type) {
    case FacetTypes.Numeric:
      return stats.reduce((acc: any, stat: any) => {
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

const getTemporalResolution = (domain: any, filters: any) => {
  if (domain !== TimeDomain) return undefined
  const days = getWidestInclusiveTimeInterval(filters)
  if (!Number.isFinite(days)) return TemporalResolution.Year
  if (days < 6 * 31) return TemporalResolution.Day
  if (days < 5 * 365) return TemporalResolution.Month
  return TemporalResolution.Year
}

const getDomainDetails = (index: any, domain: any, filters: any) => {
  if (domain === TimeDomain) {
    const { date, yearAndMonth, year } = statsConfiguration.indexes[index].facets.temporal
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

function buildSolrRequest(facet: any, index: any, domain: any, stats: any, filters: any, sort: any, groupby: any) {
  const facetType = getFacetType(index, facet)
  const domainDetails = getDomainDetails(index, domain, filters)

  const { query } = filtersToQueryAndVariables(filters, index)
  // add
  const collapse = groupby ? { fq: `{!collapse field=${groupby}}` } : null

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
  } satisfies SelectRequestBody
}

const parseDate = (val: any, resolution: any) => {
  switch (resolution) {
    case TemporalResolution.Day:
      return val.split('T')[0]
    case TemporalResolution.Month:
      return `${val}-01`
    default:
      return `${val}-01-01`
  }
}

const withLabel = async (val: any, facet: FacetLabel, app: ImpressoApplication) => {
  const extractors = getFacetLabelCache(app)
  const extractor = extractors[facet]
  return {
    label: extractor ? await extractor(val) : val,
    value: val,
  }
}

const parseValue = (object: any, facetType: any) => {
  switch (facetType) {
    case FacetTypes.Numeric:
      return object
    case FacetTypes.Term:
      return {
        count: object.count,
        items: object.items.buckets.map(({ val: term, count }: any) => ({
          term,
          count,
        })),
      }
    default:
      throw new Error(`Unknown facet type provided: ${facetType}`)
  }
}

async function buildItemsDictionary(items: any, facet: FacetLabel, app: ImpressoApplication) {
  const terms = new Set<string>(
    items.flatMap(({ value: { items: subitems = [] } }) => subitems).map(({ term }: any) => term)
  )

  const extractors = getFacetLabelCache(app)
  const extractor = extractors[facet]

  if (extractor == null) return {}

  return [...terms].reduce(
    async (accPromise, term: string) => {
      const acc = await accPromise
      acc[term] = await extractor(term as string)
      return acc
    },
    {} as Promise<Record<string, any>>
  )
}

const itemsSortFn = (a: any, b: any) => {
  if (a.domain < b.domain) return -1
  if (a.domain > b.domain) return 1
  return 0
}

async function buildResponse(result: any, facet: any, index: any, domain: any, filters: any, app: ImpressoApplication) {
  const { domain: { buckets = [] } = {} } = result.facets
  const facetType = getFacetType(index, facet)
  const resolution = getTemporalResolution(domain, filters)

  const items = (
    await Promise.all(
      buckets.map(async ({ val, ...rest }: any) => ({
        domain: domain === TimeDomain ? parseDate(val, resolution) : await withLabel(val, domain, app),
        value: parseValue(rest, facetType),
      }))
    )
  ).sort(itemsSortFn)

  return {
    items,
    itemsDictionary: await buildItemsDictionary(items, facet, app),
    meta: {
      facetType,
      domain,
      resolution,
      filters,
    },
  }
}

class Stats {
  solr: SimpleSolrClient
  app: ImpressoApplication

  constructor(app: ImpressoApplication) {
    this.solr = app.service('simpleSolrClient')
    this.app = app
  }

  /** Get simple stats for a single dimension, always numeric stats */
  async get(id: Id, params: Params<any>) {
    const { index, stats, filters } = params.query
    // get field name from config stats.yml (numeric only)
    const field = statsConfiguration.indexes[index].facets.numeric[id].field
    // transform ["min","max"] in their corresponding solr function to build the query
    // {!min=true+max=true}field
    const statsField = `{!key=statistics ${stats
      .split(',')
      .map((s: string) => StatsToSolrStatistics[s])
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
    const result = await this.solr.select(index, {
      body: {
        query,
        limit: 0,
        params: { hl: false, stats: true, 'stats.field': statsField },
      },
    })
    debug('[get] index:', index, 'stats result', result.stats?.stats_fields?.statistics)
    return {
      statistics: result.stats?.stats_fields?.statistics,
      total: result.response?.numFound,
    }
  }

  async find({ request: { facet, index, domain, stats, filters, sort, groupby } }: Params<any> & { request: any }) {
    const request = buildSolrRequest(facet, index, domain, stats, filters, sort, groupby)
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
    const result = await this.solr.select(index, { body: request })
    debug('stats result', result.facets)
    const response: any = await buildResponse(result, facet, index, domain, filters, this.app)
    debug('stats response', response.query)
    return response
    // return buildResponse(result, facet, index, domain, filters)
  }
}

module.exports = { Stats }
