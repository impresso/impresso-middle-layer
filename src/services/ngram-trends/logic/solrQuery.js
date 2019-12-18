const { filtersToQueryAndVariables } = require('../../../util/solr');

function ngramTrendsRequestToSolrQuery(ngrams, filters, facets) {
  const { query, variables } = filtersToQueryAndVariables(filters);
}

module.exports = {
  ngramTrendsRequestToSolrQuery,
};
