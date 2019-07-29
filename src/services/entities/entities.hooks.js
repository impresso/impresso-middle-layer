// const { authenticate } = require('@feathersjs/authentication').hooks;
const {
  validate, validateEach, queryWithCommonParams,
} = require('../../hooks/params');
const { filtersToSolrQuery } = require('../../hooks/search');

module.exports = {
  before: {
    all: [],
    find: [
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
            'entity-string',
            'entity-type',
          ],
          required: true,
        },
      }, {
        required: false
      }),
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
