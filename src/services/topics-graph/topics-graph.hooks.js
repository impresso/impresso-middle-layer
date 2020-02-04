const { eachFilterValidator } = require('../search/search.validators');
const { validateEach, queryWithCommonParams, validate } = require('../../hooks/params');
const { filtersToSolrQuery } = require('../../hooks/search');
const { checkCachedContents, returnCachedContents, saveResultsInCache } = require('../../hooks/redis');

module.exports = {
  before: {
    all: [],
    find: [
      checkCachedContents(),
      validate({
        q: {
          required: false,
          min_length: 1,
          max_length: 50,
        },
        expand: {
          required: false,
          defaultValue: false,
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
    find: [
      returnCachedContents(),
      saveResultsInCache(),
    ],
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
