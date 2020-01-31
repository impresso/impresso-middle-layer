const { eachFilterValidator } = require('../search/search.validators');
const { validateEach, queryWithCommonParams, validate } = require('../../hooks/params');
const { filtersToSolrQuery } = require('../../hooks/search');

module.exports = {
  before: {
    all: [],
    find: [
      validate({
        q: {
          required: false,
          min_length: 1,
          max_length: 50,
        },
      }),
      validateEach('filters', eachFilterValidator),
      filtersToSolrQuery({
        overrideOrderBy: false,
      }),
      queryWithCommonParams(),
    ],
    get: [
      validateEach('filters', eachFilterValidator),
      filtersToSolrQuery({
        overrideOrderBy: false,
      }),
      queryWithCommonParams(),
    ],
    create: [],
    update: [],
    patch: [],
    remove: [],
  },

  after: {
    all: [],
    find: [],
    get: [],
    create: [],
    update: [],
    patch: [],
    remove: [],
  },

  error: {
    all: [],
    find: [],
    get: [],
    create: [],
    update: [],
    patch: [],
    remove: [],
  },
};
