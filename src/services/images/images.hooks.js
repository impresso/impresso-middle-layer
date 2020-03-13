// const { authenticate } = require('@feathersjs/authentication').hooks;
const {
  utils, validate, validateEach, queryWithCommonParams, displayQueryParams, REGEX_UID,
} = require('../../hooks/params');
const {
  qToSolrFilter, filtersToSolrQuery,
} = require('../../hooks/search');

const {
  resolveFacets,
  resolveQueryComponents,
} = require('../../hooks/search-info');

const { eachFilterValidator } = require('../search/search.validators');


module.exports = {
  before: {
    all: [
      // authenticate('jwt')
    ],
    find: [
      validate({
        order_by: utils.orderBy({
          values: {
            random: 'random',
            id: 'id ASC',
            '-id': 'id DESC',
            relevance: 'score ASC',
            '-relevance': 'score DESC',
            date: 'meta_date_dt ASC',
            '-date': 'meta_date_dt DESC',
          },
          defaultValue: 'id',
        }),
        similarTo: {
          regex: REGEX_UID,
          required: false,
        },
        similarToUploaded: {
          regex: REGEX_UID,
          required: false,
        },
        vectorType: {
          values: ['InceptionResNetV2', 'ResNet50'],
          defaultValue: 'ResNet50',
        },
        randomPage: {
          required: false,
          transform: d => ['true', ''].includes(d),
        },
        facets: utils.facets({
          values: {
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
              limit: 20,
              numBuckets: true,
            },
            date: {
              type: 'terms',
              field: 'meta_date_dt',
              mincount: 1,
              limit: 100,
            },
          },
        }),
      }),
      validateEach('filters', eachFilterValidator, {
        required: false,
      }),
      qToSolrFilter('string'),
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
      resolveFacets(),
      displayQueryParams(['queryComponents', 'filters']),
      resolveQueryComponents(),
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
