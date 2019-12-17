
class NgramTrends {
  async create({ ngrams, filters, facets = [] }, params) {
    console.info('Ngram trends payload request: ', {
      ngrams, filters, facets, params,
    });
    return {
      trends: ngrams.map(ngram => ({ ngram, values: [] })),
      domainValues: [],
      info: {},
    };
  }
}

module.exports = {
  NgramTrends,
};
