const {
  unigramTrendsRequestToSolrQuery,
  parseUnigramTrendsResponse,
  guessTimeIntervalFromFilters,
} = require('./logic/solrQuery');

class NgramTrends {
  setup(app) {
    this.solrClient = app.get('solrClient');
  }

  async create({ ngrams, filters, facets = [] }) {
    const timeInterval = guessTimeIntervalFromFilters(filters);
    const requestPayload = unigramTrendsRequestToSolrQuery(
      ngrams[0], filters, facets, timeInterval,
    );
    const solrResponse = await this.solrClient.requestPostRaw(requestPayload);
    const response = await parseUnigramTrendsResponse(solrResponse);

    return response;
  }
}

module.exports = {
  NgramTrends,
};
