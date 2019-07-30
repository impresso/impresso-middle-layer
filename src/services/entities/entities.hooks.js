// const { authenticate } = require('@feathersjs/authentication').hooks;
const {
  validate, validateEach, queryWithCommonParams,
} = require('../../hooks/params');
const {
  qToSolrFilter,
  filtersToSolrQuery,
} = require('../../hooks/search');


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
        resolve: {
          required: false,
          transform: () => true,
        },
      }),
      validateEach('filters', {
        q: {
          max_length: 50,
          required: false,
        },
        context: {
          choices: ['include', 'exclude'],
          defaultValue: 'include',
        },
        op: {
          choices: ['AND', 'OR'],
          defaultValue: 'OR',
        },
        type: {
          choices: [
            'string',
            'type',
          ],
          required: true,
          // trasform is required because they shoyd be related to entities namespace.
          transform: d => `entity-${d}`,
        },
      }, {
        required: false,
      }),
      qToSolrFilter('entity-string'),
      filtersToSolrQuery(),
      queryWithCommonParams(),
    ],
    get: [],
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
