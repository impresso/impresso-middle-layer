const { authenticate } = require('@feathersjs/authentication').hooks;
const {
  validate, validateEach, queryWithCommonParams, REGEX_UID, REGEX_UIDS, utils,
} = require('../../hooks/params');
const { filtersToSolrQuery, SOLR_FILTER_TYPES, SOLR_ORDER_BY } = require('../../hooks/search');


module.exports = {
  before: {
    all: [
      authenticate('jwt'),
      validate({
        format: {
          required: true,
          choices: ['csv', 'text/plain'],
        },
      }),
    ],
    find: [
      validate({
        q: {
          required: false,
          min_length: 2,
          max_length: 1000,
        },
        group_by: {
          required: true,
          choices: ['articles'],
        },
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
        context: {
          choices: ['include', 'exclude'],
          required: true,
        },
        type: {
          choices: SOLR_FILTER_TYPES,
          required: true,
        },
        q: {
          required: false,
          min_length: 2,
          max_length: 500,
        },
        // compatible only with type daterange, unused elsewhere.
        // If it is an array, an OR will be used to JOIN the array items..
        // ex: ['* TO 1950-12-01', '1960-01-01 TO 1940-12-01']
        // q= ... AND (date_e:[* TO 1950-12-01] OR date_s:[1960-01-01 TO 1940-12-01])
        daterange: {
          regex: /(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z) TO (\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z)/,
          required: false,
        },

        uids: {
          regex: REGEX_UIDS,
          required: false,
          // we cannot transform since Mustache is rendering the filters...
          // transform: d => d.split(',')
        },
        uid: {
          regex: REGEX_UID,
          required: false,
          // we cannot transform since Mustache is rendering the filters...
          // transform: d => d.split(',')
        },
      }, {
        required: false,
      }),
      filtersToSolrQuery(SOLR_FILTER_TYPES),
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
