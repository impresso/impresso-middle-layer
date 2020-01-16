const {
  unigramTrendsRequestToSolrQuery,
  parseUnigramTrendsResponse,
} = require('./logic/solrQuery');

class NgramTrends {
  setup(app) {
    this.solrClient = app.get('solrClient');
  }

  async create({ ngrams, filters, facets = [] }) {
    const requestPayload = unigramTrendsRequestToSolrQuery(ngrams[0], filters, facets);
    const solrResponse = await this.solrClient.requestPostRaw(requestPayload);
    const response = await parseUnigramTrendsResponse(solrResponse);

    return response;
  }
}

module.exports = {
  NgramTrends,
};
