import { rateLimit, rollbackRateLimit, DefaultResource, addRateLimitingHeader } from '../../hooks/rateLimiter'

const { authenticate } = require('../../hooks/authenticate')
const {
  utils,
  protect,
  validate,
  validateEach,
  queryWithCommonParams,
  displayQueryParams,
  REGEX_UID,
} = require('../../hooks/params')
const { filtersToSolrQuery } = require('../../hooks/search')
const { checkCachedContents, returnCachedContents, saveResultsInCache } = require('../../hooks/redis')

const { resolveTopics, resolveUserAddons } = require('../../hooks/resolvers/articles.resolvers')
const { obfuscate } = require('../../hooks/access-rights')
const { SolrMappings } = require('../../data/constants')

module.exports = {
  before: {
    all: [
      authenticate('jwt', {
        allowUnauthenticated: true,
      }),
      rateLimit(DefaultResource),
      checkCachedContents({
        useAuthenticatedUser: false,
        useAuthentication: true,
      }),
    ],
    find: [
      validate({
        resolve: {
          required: false,
          choices: ['collection', 'tags'],
        },
        order_by: {
          before: d => {
            if (typeof d === 'string') {
              return d.split(',')
            }
            return d
          },
          choices: ['-date', 'date', '-relevance', 'relevance'],
          transform: d => utils.toOrderBy(d, SolrMappings.search.orderBy, true),
          after: d => {
            if (Array.isArray(d)) {
              return d.join(',')
            }
            return d
          },
        },
      }),
      validateEach(
        'filters',
        {
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
        },
        {
          required: false,
        }
      ),
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
    all: [addRateLimitingHeader],
    find: [
      displayQueryParams(['filters']),
      protect('content'),
      returnCachedContents({
        skipHooks: false,
      }),
      resolveTopics(),
      saveResultsInCache(),
      obfuscate(),
    ],
    get: [
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
    all: [rollbackRateLimit(DefaultResource)],
    find: [],
    get: [],
    create: [],
    update: [],
    patch: [],
    remove: [],
  },
}
