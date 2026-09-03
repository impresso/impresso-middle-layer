import moment from 'moment'
import { get, mergeWith, toPairs, fromPairs, sortBy, sum } from 'lodash-es'
import { buildSolrQuery } from '../../../util/solr/queryBuilder.js'
import { SolrNamespaces } from '../../../solr.js'
import { SupportedLanguageCodes } from '../../../models/solr.js'

import { SolrMappings } from '../../../data/constants.js'
import { FeaturesConfig } from '@/models/generated/app/configuration.js'
import { Filter } from '@/models/index.js'
import { SelectResponse } from '@/internalServices/simpleSolr.js'

const Facets = SolrMappings.search.facets as Record<string, unknown>

const TimeIntervalsFilelds = {
  year: 'meta_year_i',
  month: 'meta_yearmonth_s',
  day: 'meta_date_dt',
}

type TimeInterval = keyof typeof TimeIntervalsFilelds

const TotalTokensCountFacetField = 'ttc'
const TokensCountField = 'content_length_i'

interface TotalTokensBucket {
  val: string | number
  [key: string]: unknown
}

interface TotalTokensSolrResponse {
  facets?: Partial<Record<TimeInterval, { buckets: TotalTokensBucket[] }>>
}

interface SolrPivotEntry {
  value: string
  stats?: {
    stats_fields: Record<string, { sum: number }>
  }
}

interface UnigramTrendsSolrResponse {
  facet_counts?: {
    facet_pivot?: Record<string, SolrPivotEntry[]>
  }
}

// Default facet limit in SOLR is set to 100.
// We need all data for the stats. -1 means no limit.
// https://lucene.apache.org/solr/guide/6_6/faceting.html#Faceting-Thefacet.limitParameter
const DefaultFacetLimit = -1

const getFacetPivotString = (languageCode: string, timeIntervalField: string) =>
  `{!stats=tf_stats_${languageCode} key=${languageCode}}${timeIntervalField}`
const getStatsFieldString = (languageCode: string, unigram: string) =>
  `{!tag=tf_stats_${languageCode} key=tf_stats_${languageCode} sum=true func}termfreq(content_txt_${languageCode},'${unigram}')`

const getFacetPivotStringOtherLanguages = (timeIntervalField: string) =>
  `{!stats=tf_stats_other key=other}${timeIntervalField}`
const getStatsFieldStringOtherLanguages = (unigram: string) =>
  `{!tag=tf_stats_other key=tf_stats_other sum=true func}termfreq(content_txt,'${unigram}')`

/**
 * Construct a SOLR query to get unigram trends.
 * The query is a JSON payload to be send as a POST request.
 *
 * @param {string} unigram unigram to get trends for.
 * @param {object[]} filters a list of filters of type `src/schema/canonical/Filter.json`.
 * @param {string[]} facets a list of facets to extract alongside trend.
 *
 * @return {object} a POST JSON payload for SOLR search endpoint.
 */
function unigramTrendsRequestToSolrQuery(
  unigram: string,
  filters: Filter[],
  facets: string[] = [],
  timeInterval: TimeInterval = 'year',
  featuresConfig: FeaturesConfig
) {
  const {
    query,
    filter,
    params: variables,
  } = buildSolrQuery(filters ?? [], SolrNamespaces.Search, [], featuresConfig)
  const timeIntervalField = TimeIntervalsFilelds[timeInterval]

  const facetPivots = SupportedLanguageCodes.map(languageCode =>
    getFacetPivotString(languageCode, timeIntervalField)
  ).concat(getFacetPivotStringOtherLanguages(timeIntervalField))
  const statsFields = SupportedLanguageCodes.map(languageCode => getStatsFieldString(languageCode, unigram)).concat(
    getStatsFieldStringOtherLanguages(unigram)
  )

  return {
    query,
    filter,
    limit: 0,
    params: {
      ...variables,
      facet: true,
      'facet.limit': DefaultFacetLimit,
      'facet.pivot': facetPivots,
      'stats.field': statsFields,
      stats: true,
      'json.facet': JSON.stringify(
        facets.reduce((acc: Record<string, unknown>, facet) => {
          acc[facet] = Facets[facet]
          return acc
        }, {})
      ),
      hl: false, // disable duplicate field "highlighting"
    },
  }
}

function unigramTrendsRequestToTotalTokensSolrQuery(
  filters: Filter[],
  featuresConfig: FeaturesConfig,
  timeInterval: TimeInterval = 'year'
) {
  const {
    query,
    filter,
    params: variables,
  } = buildSolrQuery(filters, SolrNamespaces.Search, [], featuresConfig)
  const timeIntervalField = TimeIntervalsFilelds[timeInterval]

  return {
    query,
    filter,
    limit: 0,
    params: {
      ...variables,
      hl: false, // disable duplicate field "highlighting"
    },
    facet: {
      [timeInterval]: {
        type: 'terms' as const,
        field: timeIntervalField,
        limit: DefaultFacetLimit,
        facet: {
          [TotalTokensCountFacetField]: `sum(${TokensCountField})`,
        },
      },
    },
  }
}

const mergeFn = (dst: number | undefined, src: number | undefined) => (dst || 0) + (src || 0)

/**
 * Convert raw SOLR response to `ngram-trends/schema/post/response.json`.
 */
async function parseUnigramTrendsResponse(
  solrResponse: SelectResponse<{}, '', {}>,
  unigram: string,
  timeInterval: string
) {
  const pivots = get(solrResponse, 'facet_counts.facet_pivot', {}) as Record<string, SolrPivotEntry[]>
  const languageCodes = Object.keys(pivots)
  const domainToValuesMapping = languageCodes.reduce((acc: Record<string, number>, languageCode) => {
    const pivotEntries: SolrPivotEntry[] = pivots[languageCode]
    const entries = pivotEntries
      .map((entry: SolrPivotEntry) => {
        const key = entry.value
        const value = get(entry, `stats.stats_fields.tf_stats_${languageCode}.sum`) as number
        return [key, value] as [string, number]
      })
      .sort((a: [string, number], b: [string, number]) => {
        if (a[0] < b[0]) return -1
        if (a[0] > b[0]) return 1
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

function getNumbersFromTotalTokensResponse(response: TotalTokensSolrResponse, timeInterval: TimeInterval = 'year') {
  const { facets = {} } = response || {}
  const { buckets = [] } = facets[timeInterval] || {}

  return buckets
    .map(({ val, [TotalTokensCountFacetField]: value }: { val: unknown; [key: string]: unknown }) => ({
      domain: `${val}`,
      value,
    }))
    .sort((a: { domain: string }, b: { domain: string }) => {
      if (a.domain < b.domain) return -1
      if (a.domain > b.domain) return 1
      return 0
    })
}

const DaterangeFilterValueRegex = /([^\s]+)\s+TO\s+([^\s]+)/

function getTimedeltaInDaterangeFilter(daterangeFilter: Filter) {
  if (daterangeFilter.q == null) return undefined
  const value = Array.isArray(daterangeFilter.q) ? daterangeFilter.q[0] : daterangeFilter.q
  const matches = DaterangeFilterValueRegex.exec(value)
  if (matches == null || matches.length !== 3) return undefined
  if (daterangeFilter.context === 'exclude') return undefined

  const [fromDate, toDate] = [...matches.slice(1)].map(v => moment.utc(v))
  const years = moment.duration(toDate.diff(fromDate)).as('years')

  return years
}

function guessTimeIntervalFromFilters(filters: Filter[] = []): TimeInterval {
  const daterangeFilters = filters.filter(({ type }) => type === 'daterange')
  const timedeltas = daterangeFilters
    .map(getTimedeltaInDaterangeFilter)
    .filter((v): v is number => v !== undefined)
    .sort()
  const shortestTimedelta = timedeltas[0]

  if (!isFinite(shortestTimedelta)) return 'year'
  if (shortestTimedelta < 1) return 'day'
  if (shortestTimedelta < 5) return 'month'
  return 'year'
}

export {
  unigramTrendsRequestToSolrQuery,
  parseUnigramTrendsResponse,
  guessTimeIntervalFromFilters,
  unigramTrendsRequestToTotalTokensSolrQuery,
  getNumbersFromTotalTokensResponse,
}
