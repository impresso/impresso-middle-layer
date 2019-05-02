const {
  validate, validateEach, queryWithCommonParams, displayQueryParams, REGEX_UID, REGEX_UIDS, utils,
} = require('../../hooks/params');
const {
  filtersToSolrQuery, qToSolrFilter, filtersToSolrFacetQuery,
  SOLR_FILTER_TYPES, SOLR_ORDER_BY, SOLR_FACETS, SOLR_GROUP_BY,
} = require('../../hooks/search');
const { assignIIIF } = require('../../hooks/iiif');
const { protect } = require('@feathersjs/authentication-local').hooks;
const { authenticate } = require('@feathersjs/authentication').hooks;

const Newspaper = require('../../models/newspapers.model');
const Topic = require('../../models/topics.model');

const resolveQueryComponents = () => async (context) => {
  const qc = context.params.sanitized.queryComponents.map((d) => {
    if (d.type === 'newspaper') {
      if (!Array.isArray(d.q)) {
        d.item = Newspaper.getCached(d.q);
      } else {
        d.items = d.q.map(uid => Newspaper.getCached(uid));
      }
    } else if (d.type === 'topic') {
      if (!Array.isArray(d.q)) {
        d.item = Topic.getCached(d.q);
      } else {
        d.items = d.q.map(uid => Topic.getCached(uid));
      }
    }
    return d;
  });
  context.params.sanitized.queryComponents = qc;
};

const filtersValidator = {
  context: {
    choices: ['include', 'exclude'],
    defaultValue: 'include',
  },
  op: {
    choices: ['AND', 'OR'],
    defaultValue: 'OR',
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
};

module.exports = {
  before: {
    all: [],
    find: [
      authenticate('jwt', {
        allowUnauthenticated: true,
      }),
      validate({
        q: {
          required: false,
          min_length: 2,
          max_length: 1000,
        },
        group_by: {
          required: true,
          choices: ['articles'],
          transform: d => utils.translate(d, SOLR_GROUP_BY),
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
        facets: utils.facets({
          values: SOLR_FACETS,
        }),
      }),

      validateEach('filters', filtersValidator, {
        required: false,
      }),

      validateEach('facetfilters', {
        name: {
          choices: Object.keys(SOLR_FACETS),
          required: true,
        },
        q: {
          required: false,
          min_length: 2,
          max_length: 10,
        },
        page: {
          required: false,
          regex: /\d+/,
        },
      }, {
        required: false,
      }),

      filtersToSolrFacetQuery(),

      qToSolrFilter('string'),
      filtersToSolrQuery(SOLR_FILTER_TYPES),
      queryWithCommonParams(),
    ],
    get: [],
    create: [
      authenticate('jwt'),
      validate({
        collection_uid: {
          required: true,
          regex: REGEX_UID,
        },
        group_by: {
          required: true,
          choices: ['articles'],
          transform: d => utils.translate(d, SOLR_GROUP_BY),
        },
      }, 'GET'),
      validateEach('filters', filtersValidator, {
        required: true,
        method: 'GET',
      }),
      qToSolrFilter('string'),
      filtersToSolrQuery(SOLR_FILTER_TYPES),
    ],
    update: [],
    patch: [],
    remove: [],
  },

  after: {
    all: [],
    find: [
      assignIIIF('pages', 'matches'),
      displayQueryParams(['queryComponents', 'filters']),
      resolveQueryComponents(),
      protect('content'),
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
