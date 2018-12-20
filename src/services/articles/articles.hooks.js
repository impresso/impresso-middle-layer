// const { authenticate } = require('@feathersjs/authentication').hooks;
const {
  utils, protect, validate, validateEach, queryWithCommonParams, displayQueryParams, REGEX_UID,
} = require('../../hooks/params');
const { assignIIIF } = require('../../hooks/iiif');
const { filtersToSolrQuery, SOLR_ORDER_BY } = require('../../hooks/search');

module.exports = {
  before: {
    all: [

    ], // authenticate('jwt') ],
    find: [
      validate({
        order_by: {
          before: (d) => {
            if (typeof d === 'string') {
              return d.split(',');
            }
            return d;
          },
          choices: ['-date', 'date', '-relevance', 'relevance'],
          transform: d => utils.toOrderBy(d, SOLR_ORDER_BY, true),
          after: (d) => {
            if (Array.isArray(d)) {
              return d.join(',');
            }
            return d;
          },
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
