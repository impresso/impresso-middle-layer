const { authenticate } = require('@feathersjs/authentication').hooks;
const {
  utils, protect, validate, validateEach, queryWithCommonParams, displayQueryParams, REGEX_UID,
} = require('../../hooks/params');
const { assignIIIF } = require('../../hooks/iiif');
const { filtersToSolrQuery, SOLR_ORDER_BY } = require('../../hooks/search');
const { checkCachedContents, returnCachedContents, saveResultsInCache } = require('../../hooks/redis');

const { resolveTopics, resolveUserAddons } = require('../../hooks/resolvers/articles.resolvers');
const { obfuscate } = require('../../hooks/access-rights');


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
        resolve: {
          required: false,
          choices: ['collection', 'tags'],
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
        type: {
          choices: ['uid', 'issue', 'page', 'newspaper', 'hasTextContents'],
          required: true,
        },
        q: {
          regex: REGEX_UID,
          required: false,
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
      returnCachedContents({
        skipHooks: false,
      }),
      saveResultsInCache(),
      resolveUserAddons(),
      obfuscate(),
    ],
    get: [
      assignIIIF('pages', 'issue', 'regions'),
      // save here cache, flush cache here
      returnCachedContents({
        skipHooks: false,
      }),
      resolveTopics(),
      saveResultsInCache(),
      resolveUserAddons(),
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
