const { authenticate } = require('@feathersjs/authentication').hooks;
const {
  eachFilterValidator, eachFacetFilterValidator, paramsValidator, facetsValidator,
} = require('../search/search.validators');
const {
  validate, validateEach, queryWithCommonParams,
} = require('../../hooks/params');
const { filtersToSolrQuery } = require('../../hooks/search');

module.exports = {
  before: {
    all: [],
    get: [
      authenticate('jwt', {
        allowUnauthenticated: true,
      }),
      validate({
        ...paramsValidator,
      }),
      validateEach('filters', eachFilterValidator),
      filtersToSolrQuery(),
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
