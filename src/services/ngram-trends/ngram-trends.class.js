const { SolrNamespaces } = require('../../solr')
const {
  unigramTrendsRequestToSolrQuery,
  parseUnigramTrendsResponse,
  guessTimeIntervalFromFilters,
  unigramTrendsRequestToTotalTokensSolrQuery,
  getNumbersFromTotalTokensResponse,
} = require('./logic/solrQuery')

function mergeResponses(responses, totalsResponse) {
  const timeIntervals = [...new Set(responses.map(({ timeInterval }) => timeInterval))]
  if (timeIntervals.length > 1) throw new Error(`Conflicting time intervals found: ${timeIntervals.join(', ')}`)
  const timeInterval = timeIntervals[0]

  // Extract domain values (year, month, date), flaten them, create unique list and sort
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

  // totals
  const totalsMap = totalsResponse.reduce((acc, { domain, value }) => ({ ...acc, [domain]: value }), {})

  const totals = commonDomainValues.map(domain => {
    const value = totalsMap[`${domain}`]
    return value == null ? 0 : value
  })

  return {
    trends: mergedTrends,
    domainValues: commonDomainValues,
    totals,
    timeInterval,
  }
}

class NgramTrends {
  setup(app) {
    /** @type {import('../../internalServices/simpleSolr').SimpleSolrClient} */
    this.solr = app.service('simpleSolrClient')
  }

  async create({ ngrams, filters, facets = [] }) {
    const timeInterval = guessTimeIntervalFromFilters(filters)

    const requestPayloads = ngrams.map(ngram => unigramTrendsRequestToSolrQuery(ngram, filters, facets, timeInterval))
    const totalsRequestPayload = unigramTrendsRequestToTotalTokensSolrQuery(filters, timeInterval)

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

module.exports = {
  NgramTrends,
}
