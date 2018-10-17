// const { authenticate } = require('@feathersjs/authentication').hooks;
const {
  protect, validate, validateEach, queryWithCommonParams, displayQueryParams, REGEX_UID,
} = require('../../hooks/params');
const { assignIIIF } = require('../../hooks/iiif');
const { filtersToSolrQuery } = require('../../hooks/search');

module.exports = {
  before: {
    all: [

    ], // authenticate('jwt') ],
    find: [
      validate({
        order_by: {
          choices: ['-date', 'date', '-relevance', 'relevance'],
        },
      }),
      validateEach('filters', {
        type: {
          choices: ['uid', 'issue', 'page', 'newspaper'],
          required: true,
        },
        q: {
          regex: REGEX_UID,
          required: true,
          // we cannot transform since Mustache is render the filters...
          // transform: d => d.split(',')
        },
      }, {
        required: false,
      }),
      filtersToSolrQuery(['issue', 'page']),
      queryWithCommonParams(),
    ],
    get: [],
    create: [],
    update: [],
    patch: [],
    remove: [],
  },

  after: {
    all: [

    ],
    find: [
      assignIIIF('pages', 'issue', 'regions'),
      displayQueryParams(['filters']),
      protect('content'),
    ],
    get: [
      assignIIIF('pages', 'issue', 'regions'),
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
