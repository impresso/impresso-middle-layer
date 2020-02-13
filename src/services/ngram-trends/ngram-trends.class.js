const {
  unigramTrendsRequestToSolrQuery,
  parseUnigramTrendsResponse,
  guessTimeIntervalFromFilters,
} = require('./logic/solrQuery');

/** Default request that should be cached for longer. */
const DefaultRequest = 'impresso';

class NgramTrends {
  setup(app) {
    this.solr = app.get('cachedSolr');
  }

  async create({ ngrams, filters, facets = [] }) {
    const timeInterval = guessTimeIntervalFromFilters(filters);
    const requestPayload = unigramTrendsRequestToSolrQuery(
      ngrams[0], filters, facets, timeInterval,
    );

    const cacheTtl = ngrams[0] === DefaultRequest
      ? this.solr.ttl.Long
      : this.solr.ttl.Default;

    const solrResponse = await this.solr.post(
      requestPayload,
      this.solr.namespaces.Search,
      cacheTtl,
    );
    const response = await parseUnigramTrendsResponse(solrResponse, ngrams[0], timeInterval);

    return response;
  }
}

module.exports = {
  NgramTrends,
};
