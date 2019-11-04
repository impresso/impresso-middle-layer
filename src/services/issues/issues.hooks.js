const {
  utils, validate, validateEach, queryWithCommonParams,
} = require('../../hooks/params');
const { obfuscate } = require('../../hooks/access-rights');
const { authenticate } = require('../../hooks/authenticate');
const { filtersToSolrQuery } = require('../../hooks/search');
const { checkCachedContents, returnCachedContents, saveResultsInCache } = require('../../hooks/redis');

module.exports = {
  before: {
    all: [
      authenticate('jwt', {
        allowUnauthenticated: true,
      }),
      checkCachedContents({
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
      returnCachedContents(),
      saveResultsInCache(),
    ],
    get: [
      // change count_pages
      obfuscate(),
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
