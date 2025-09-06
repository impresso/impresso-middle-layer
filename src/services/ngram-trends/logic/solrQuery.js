import moment from 'moment'
const { get, mergeWith, toPairs, fromPairs, sortBy, sum } = require('lodash')
const { filtersToQueryAndVariables, ContentLanguages } = require('../../../util/solr')
import { SolrNamespaces } from '../../../solr'

import { SolrMappings } from '../../../data/constants'

const Facets = SolrMappings.search.facets

const TimeIntervalsFilelds = {
  year: 'meta_year_i',
  month: 'meta_yearmonth_s',
  day: 'meta_date_dt',
}

const TotalTokensCountFacetField = 'ttc'
const TokensCountField = 'content_length_i'

// Default facet limit in SOLR is set to 100.
// We need all data for the stats. -1 means no limit.
// https://lucene.apache.org/solr/guide/6_6/faceting.html#Faceting-Thefacet.limitParameter
const DefaultFacetLimit = -1

const getFacetPivotString = (languageCode, timeIntervalField) =>
  // eslint-disable-next-line implicit-arrow-linebreak
  `{!stats=tf_stats_${languageCode} key=${languageCode}}${timeIntervalField}`
const getStatsFieldString = (languageCode, unigram) =>
  // eslint-disable-next-line implicit-arrow-linebreak
  `{!tag=tf_stats_${languageCode} key=tf_stats_${languageCode} sum=true func}termfreq(content_txt_${languageCode},'${unigram}')`

/**
 * Construct a SOLR query to get unigram trends.
 * The query is a JSON payload to be send as a POST request.
 *
 * @param {string} unigram unigram to get trends for.
 * @param {object[]} filters a list of filters of type `src/schema/search/filter.json`.
 * @param {string[]} facets a list of facets to extract alongside trend.
 *
 * @return {object} a POST JSON payload for SOLR search endpoint.
 */
function unigramTrendsRequestToSolrQuery(unigram, filters, facets = [], timeInterval = 'year') {
  const { query, variables } = filtersToQueryAndVariables(filters, SolrNamespaces.Search)
  const timeIntervalField = TimeIntervalsFilelds[timeInterval]

  const facetPivots = ContentLanguages.map(languageCode => getFacetPivotString(languageCode, timeIntervalField))
  const statsFields = ContentLanguages.map(languageCode => getStatsFieldString(languageCode, unigram))

  return {
    query,
    limit: 0,
    params: {
      vars: variables,
      facet: true,
      'facet.limit': DefaultFacetLimit,
      'facet.pivot': facetPivots,
      'stats.field': statsFields,
      stats: true,
      'json.facet': JSON.stringify(
        facets.reduce((acc, facet) => {
          acc[facet] = Facets[facet]
          return acc
        }, {})
      ),
      hl: false, // disable duplicate field "highlighting"
    },
  }
}

/**
 * @param {import('../../../models').Filter[]} filters
 * @param {'year' | 'month' | 'day'} timeInterval
 * @returns {any}
 */
function unigramTrendsRequestToTotalTokensSolrQuery(filters, timeInterval = 'year') {
  const { query, variables } = filtersToQueryAndVariables(filters, SolrNamespaces.Search)
  const timeIntervalField = TimeIntervalsFilelds[timeInterval]

  return {
    query,
    limit: 0,
    params: {
      vars: variables,
      hl: false, // disable duplicate field "highlighting"
    },
    facet: {
      [timeInterval]: {
        type: 'terms',
        field: timeIntervalField,
        limit: DefaultFacetLimit,
        facet: {
          [TotalTokensCountFacetField]: `sum(${TokensCountField})`,
        },
      },
    },
  }
}

const mergeFn = (dst, src) => (dst || 0) + (src || 0)

/**
 * Convert raw SOLR response to `ngram-trends/schema/post/response.json`.
 * @param {object} solrResponse SOLR trends response
 */
async function parseUnigramTrendsResponse(solrResponse, unigram, timeInterval) {
  const pivots = get(solrResponse, 'facet_counts.facet_pivot', {})
  const languageCodes = Object.keys(pivots)
  const domainToValuesMapping = languageCodes.reduce((acc, languageCode) => {
    const pivotEntries = pivots[languageCode]
    const entries = pivotEntries
      .map(entry => {
        const key = entry.value
        const value = get(entry, `stats.stats_fields.tf_stats_${languageCode}.sum`)
        return [key, value]
      })
      .sort((a, b) => {
        if (a < b) return -1
        if (a > b) return 1
        return 0
      })
    return mergeWith(acc, fromPairs(entries), mergeFn)
  }, {})

  const domainAndValueItems = sortBy(toPairs(domainToValuesMapping), ([domain]) => domain)

  const domainValues = domainAndValueItems.map(([domain]) => domain)
  const values = domainAndValueItems.map(([, value]) => value)

  const total = sum(values)

  return {
    trends: [
      {
        ngram: unigram,
        values,
        total,
      },
    ],
    domainValues,
    timeInterval,
  }
}

/**
 *
 * @param {any} response
 * @returns {{ domain: string, value: number }[]}
 */
function getNumbersFromTotalTokensResponse(response, timeInterval = 'year') {
  const { facets = {} } = response || {}
  const { buckets = [] } = facets[timeInterval] || {}

  return buckets
    .map(({ val, [TotalTokensCountFacetField]: value }) => ({ domain: `${val}`, value }))
    .sort((a, b) => {
      if (a.domain < b.domain) return -1
      if (a.domain > b.domain) return 1
      return 0
    })
}

const DaterangeFilterValueRegex = /([^\s]+)\s+TO\s+([^\s]+)/

function getTimedeltaInDaterangeFilter(daterangeFilter) {
  const value = Array.isArray(daterangeFilter.q) ? daterangeFilter.q[0] : daterangeFilter.q
  const matches = DaterangeFilterValueRegex.exec(value)
  if (matches.length !== 3) return undefined
  if (daterangeFilter.context === 'exclude') return undefined

  const [fromDate, toDate] = [...matches.slice(1)].map(v => moment.utc(v))
  const years = moment.duration(toDate.diff(fromDate)).as('years')

  return years
}

function guessTimeIntervalFromFilters(filters = []) {
  const daterangeFilters = filters.filter(({ type }) => type === 'daterange')
  const timedeltas = daterangeFilters
    .map(getTimedeltaInDaterangeFilter)
    .filter(v => v !== undefined)
    .sort()
  const shortestTimedelta = timedeltas[0]

  // eslint-disable-next-line no-restricted-globals
  if (!isFinite(shortestTimedelta)) return 'year'
  if (shortestTimedelta < 1) return 'day'
  if (shortestTimedelta < 5) return 'month'
  return 'year'
}

export default {
  unigramTrendsRequestToSolrQuery,
  parseUnigramTrendsResponse,
  guessTimeIntervalFromFilters,
  unigramTrendsRequestToTotalTokensSolrQuery,
  getNumbersFromTotalTokensResponse,
}
