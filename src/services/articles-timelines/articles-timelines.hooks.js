const {
  validate, validateEach, queryWithCommonParams, REGEX_UID,
} = require('../../hooks/params');
const { filtersToSolrQuery } = require('../../hooks/search');
const { checkCachedContents, returnCachedContents, saveResultsInCache } = require('../../hooks/redis');


module.exports = {
  before: {
    all: [],
    find: [],
    get: [
      checkCachedContents({
        useAuthenticatedUser: false,
      }),
      validate({
      }),
      validateEach('filters', {
        type: {
          choices: ['uid', 'issue', 'page', 'newspaper', 'topic'],
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
      filtersToSolrQuery(),
      queryWithCommonParams(),
    ],
    create: [],
    update: [],
    patch: [],
    remove: [],
  },

  after: {
    all: [],
    find: [],
    get: [
      returnCachedContents(),
      saveResultsInCache(),
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
