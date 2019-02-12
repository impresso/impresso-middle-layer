const {
  utils, validate, validateEach, queryWithCommonParams,
} = require('../../hooks/params');
const { filtersToSolrQuery } = require('../../hooks/search');
const { assignIIIF } = require('../../hooks/iiif');
const redisHooks = require('../../hooks/redis');


module.exports = {
  before: {
    all: [
      redisHooks.checkCachedContents({
        useAuthenticatedUser: false,
      }),
    ],
    find: [
      validate({
        q: {
          required: false,
          min_length: 2,
          max_length: 1000,
        },
        order_by: utils.orderBy({
          values: {
            name: 'meta_issue_id_s ASC',
            '-name': 'meta_issue_id_s DESC',
            date: 'meta_date_dt ASC',
            '-date': 'meta_date_dt DESC',
            relevance: 'score ASC',
            '-relevance': 'score DESC',
          },
          defaultValue: 'name',
        }),
      }),
      validateEach('filters', {
        context: {
          choices: ['include', 'exclude'],
          defaultValue: 'include',
          required: true,
        },
        type: {
          choices: ['newspaper'],
          required: true,
        },
        q: {
          required: false,
          min_length: 2,
          max_length: 500,
        },
      }, {
        required: false,
      }),

      filtersToSolrQuery('newspaper'),
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
      redisHooks.returnCachedContents(),
      assignIIIF('cover'),
      redisHooks.saveResultsInCache(),
    ],
    get: [
      // change count_pages
      assignIIIF('pages'),
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
