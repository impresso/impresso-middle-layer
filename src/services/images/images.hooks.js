// const { authenticate } = require('@feathersjs/authentication').hooks;
const { assignIIIF } = require('../../hooks/iiif');
const {
  utils, validate, queryWithCommonParams,
} = require('../../hooks/params');
const {
  qToSolrFilter, filtersToSolrQuery,
} = require('../../hooks/search');

module.exports = {
  before: {
    all: [
      // authenticate('jwt')
    ],
    find: [
      validate({
        order_by: utils.orderBy({
          values: {
            relevance: 'score ASC',
            '-relevance': 'score DESC',
          },
          defaultValue: 'relevance',
        }),
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

      qToSolrFilter('string'),
      filtersToSolrQuery(['newspaper', 'year', 'type', 'daterange', 'isFront']),
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
      assignIIIF('pages', 'regions'),
    ],
    get: [
      assignIIIF('pages', 'regions'),
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
