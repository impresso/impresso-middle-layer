import { SolrNamespaces } from '@/solr.js'
import {
  unigramTrendsRequestToSolrQuery,
  parseUnigramTrendsResponse,
  guessTimeIntervalFromFilters,
  unigramTrendsRequestToTotalTokensSolrQuery,
  getNumbersFromTotalTokensResponse,
} from '@/services/ngram-trends/logic/solrQuery.js'
import { type SimpleSolrClient } from '@/internalServices/simpleSolr.js'
import { type ImpressoApplication } from '@/types.js'
import { type Filter } from '@/models/index.js'
import { type FeaturesConfig } from '@/models/generated/app/configuration.js'

type TrendItem = { ngram: string; values: number[]; total: number }
type UnigramTrendResponse = { trends: TrendItem[]; domainValues: string[]; timeInterval: string }
type TotalsItem = { domain: string; value: unknown }

function mergeResponses(responses: UnigramTrendResponse[], totalsResponse: TotalsItem[]) {
  const timeIntervals = [...new Set(responses.map(({ timeInterval }) => timeInterval))]
  if (timeIntervals.length > 1) throw new Error(`Conflicting time intervals found: ${timeIntervals.join(', ')}`)
  const timeInterval = timeIntervals[0]

  // Extract domain values (year, month, date), flatten them, create unique list and sort
  const commonDomainValues = [...new Set(responses.flatMap(({ domainValues }) => domainValues))].sort()

  const mergedTrends = responses.map(({ trends, domainValues }) => {
    const { ngram, values, total } = trends[0]
    const newValues = commonDomainValues.map(domainValue => {
      const index = domainValues.indexOf(domainValue)
      if (index < 0) return 0
      return values[index]
    })

    return { ngram, values: newValues, total }
  })

  const totalsMap = totalsResponse.reduce<Record<string, unknown>>(
    (acc, { domain, value }) => ({ ...acc, [domain]: value }),
    {}
  )

  const totals = commonDomainValues.map(domain => {
    const value = totalsMap[domain]
    return typeof value === 'number' ? value : 0
  })

  return {
    trends: mergedTrends,
    domainValues: commonDomainValues,
    totals,
    timeInterval,
  }
}

export class NgramTrends {
  private solr!: SimpleSolrClient
  private app!: ImpressoApplication

  setup(app: ImpressoApplication) {
    this.solr = app.service('simpleSolrClient')
    this.app = app
  }

  async create({ ngrams, filters, facets = [] }: { ngrams: string[]; filters: Filter[]; facets?: string[] }) {
    const timeInterval = guessTimeIntervalFromFilters(filters)
    const features = (this.app.get('features') ?? {}) as FeaturesConfig

    const requestPayloads = ngrams.map(ngram =>
      unigramTrendsRequestToSolrQuery(ngram, filters, facets, timeInterval, features)
    )
    const totalsRequestPayload = unigramTrendsRequestToTotalTokensSolrQuery(filters, features, timeInterval)

    const requests = requestPayloads.map(payload => this.solr.select(SolrNamespaces.Search, { body: payload }))
    const totalsRequest = this.solr.select(SolrNamespaces.Search, { body: totalsRequestPayload })

    const solrResponses = await Promise.all(requests.concat([totalsRequest]))

    const responsesPromises = ngrams.map((ngram, index) =>
      parseUnigramTrendsResponse(solrResponses[index], ngram, timeInterval)
    )
    const responses = await Promise.all(responsesPromises)

    const totalsResponse = getNumbersFromTotalTokensResponse(solrResponses[solrResponses.length - 1], timeInterval)

    return mergeResponses(responses, totalsResponse)
  }
}
