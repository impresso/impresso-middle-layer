const {
  unigramTrendsRequestToSolrQuery,
  parseUnigramTrendsResponse,
  guessTimeIntervalFromFilters,
} = require('./logic/solrQuery');

class NgramTrends {
  setup(app) {
    this.solr = app.get('cachedSolr');
  }

  async create({ ngrams, filters, facets = [] }) {
    const timeInterval = guessTimeIntervalFromFilters(filters);
    const requestPayload = unigramTrendsRequestToSolrQuery(
      ngrams[0], filters, facets, timeInterval,
    );
    const solrResponse = await this.solr.post(
      requestPayload,
      this.solr.namespaces.Search,
      this.solr.ttl.Long,
    );
    const response = await parseUnigramTrendsResponse(solrResponse, ngrams[0], timeInterval);

    return response;
  }
}

module.exports = {
  NgramTrends,
};
