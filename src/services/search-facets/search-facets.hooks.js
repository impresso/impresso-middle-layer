const { authenticate } = require('../../hooks/authenticate');
const {
  eachFilterValidator, paramsValidator,
} = require('../search/search.validators');
const {
  validate, validateEach, queryWithCommonParams, utils,
} = require('../../hooks/params');
const { filtersToSolrQuery } = require('../../hooks/search');
const { resolveCollections } = require('../../hooks/resolvers');
const { DefaultIndex, SupportedIndexes } = require('./logic')

module.exports = {
  before: {
    all: [],
    get: [
      authenticate('jwt', {
        allowUnauthenticated: true,
      }),
      validate({
        index: {
          choices: SupportedIndexes,
          defaultValue: DefaultIndex,
        },
        q: paramsValidator.q,
        order_by: {
          before: d => (Array.isArray(d) ? d.pop() : d),
          defaultValue: '-count',
          choices: ['-count', 'count'],
          transform: d => utils.translate(d, {
            '-count': {
              count: 'desc',
            },
            count: {
              count: 'asc',
            },
          }),
        },
      }),
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
      // resolve(),
    ],
    get: [
      resolveCollections(),
    ],
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
