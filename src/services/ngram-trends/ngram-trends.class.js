const {
  unigramTrendsRequestToSolrQuery,
  parseUnigramTrendsResponse,
  guessTimeIntervalFromFilters,
} = require('./logic/solrQuery');

function mergeResponses(responses) {
  const timeIntervals = [...new Set(responses.map(({ timeInterval }) => timeInterval))];
  if (timeIntervals.length > 1) throw new Error(`Conflicting time intervals found: ${timeIntervals.join(', ')}`);
  const timeInterval = timeIntervals[0];

  const commonDomainValues = [...new Set(
    responses.flatMap(({ domainValues }) => domainValues),
  )].sort();
  const mergedTrends = responses.map(({ trends, domainValues }) => {
    const { ngram, values } = trends[0];
    const newValues = commonDomainValues.map((domainValue) => {
      const index = domainValues.indexOf(domainValue);
      if (index < 0) return 0;
      return values[index];
    });

    return { ngram, values: newValues };
  });

  return {
    trends: mergedTrends,
    domainValues: commonDomainValues,
    timeInterval,
  };
}

class NgramTrends {
  setup(app) {
    this.solr = app.get('cachedSolr');
  }

  async create({ ngrams, filters, facets = [] }) {
    const timeInterval = guessTimeIntervalFromFilters(filters);

    const requestPayloads = ngrams.map(ngram => unigramTrendsRequestToSolrQuery(
      ngram, filters, facets, timeInterval,
    ));

    const cacheTtl = this.solr.ttl.Long;

    const requests = requestPayloads.map(payload => this.solr.post(
      payload,
      this.solr.namespaces.Search,
      cacheTtl,
    ));
    const solrResponses = await Promise.all(requests);

    const responsesPromises = ngrams.map((ngram, index) => parseUnigramTrendsResponse(
      solrResponses[index],
      ngram,
      timeInterval,
    ));
    const responses = await Promise.all(responsesPromises);

    return mergeResponses(responses);
  }
}

module.exports = {
  NgramTrends,
};
