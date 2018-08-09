const {
  validate, validateEach, queryWithCommonParams, displayQueryParams, REGEX_UID, REGEX_UIDS, utils,
} = require('../../hooks/params');
const { filtersToSolrQuery } = require('../../hooks/search');
const { proxyIIIF } = require('../../hooks/iiif');

const SOLR_FACETS = {
  year: {
    type: 'terms',
    field: 'meta_year_i',
    mincount: 1,
    limit: 400,
  },
  newspaper: {
    type: 'terms',
    field: 'meta_journal_s',
    mincount: 1,
    maxcount: 750,
  },
  date: {
    type: 'terms',
    field: 'meta_date_dt',
    mincount: 1,
    limit: 100,
  },
  language: {
    type: 'terms',
    field: 'lg_s',
    mincount: 1,
  },
};

const SOLR_ORDER_BY = {
  date: 'meta_date_dt',
  relevance: 'score',
};

module.exports = {
  before: {
    all: [],
    find: [
      validate({
        q: {
          required: false,
          min_length: 2,
          max_length: 1000,
        },
        group_by: {
          required: true,
          choices: ['articles', 'pages'],
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
        facets: {
          before: (d) => {
            if (typeof d === 'string') {
              return d.split(',');
            }
            return d;
          },
          choices: Object.keys(SOLR_FACETS),
          after: (fields) => {
            const _facets = {};
            fields.forEach((field) => {
              _facets[field] = SOLR_FACETS[field];
            });
            return JSON.stringify(_facets);
          },
        },
      }),
      validateEach('filters', {
        context: {
          choices: ['include', 'exclude'],
          required: true,
        },
        type: {
          choices: ['string', 'entity', 'newspaper', 'daterange'],
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
    find: [
      proxyIIIF(),
      displayQueryParams(['queryComponents', 'filters']),
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
