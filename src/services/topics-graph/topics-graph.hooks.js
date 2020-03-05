const { eachFilterValidator } = require('../search/search.validators');
const { validateEach, queryWithCommonParams, validate } = require('../../hooks/params');
const { filtersToSolrQuery } = require('../../hooks/search');
const { checkCachedContents, returnCachedContents, saveResultsInCache } = require('../../hooks/redis');

/**
 * A special case context validator for the 'find' endpoint here.
 */
const findEachFilterValidator = { ...eachFilterValidator };
findEachFilterValidator.context = { ...eachFilterValidator.context };
findEachFilterValidator.context.choices = eachFilterValidator.context.choices.concat[['visualize']];

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
      validateEach('filters', findEachFilterValidator),
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
