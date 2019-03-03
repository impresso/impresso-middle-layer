const { authenticate } = require('@feathersjs/authentication').hooks;
const {
  utils, protect, validate, validateEach, queryWithCommonParams, displayQueryParams, REGEX_UID,
} = require('../../hooks/params');
const { assignIIIF } = require('../../hooks/iiif');
const { filtersToSolrQuery, SOLR_ORDER_BY } = require('../../hooks/search');
const { checkCachedContents, returnCachedContents, saveResultsInCache } = require('../../hooks/redis');

const { resolveTopics } = require('../../hooks/resolvers/articles.resolvers');

const resolveUserAddons = () => async (context) => {
  console.log('resolveUserAddons!!', context.params.authenticated);
  if (!context.params.authenticated) {
    return;
  }
  let uids = [];
  if (Array.isArray(context.result)) {
    uids = context.result.map(d => d.uid);
  } else if (context.result.data && context.result.data.length) {
    uids = context.result.data.map(d => d.uid);
  } else if (context.result && context.result.uid) {
    uids.push(context.result.uid);
  }

  if (!uids.length) {
    return;
  }
  const collectables = await context.app.service('collectable-items').find({
    ...context.params,
    query: {
      resolve: 'collection',
      item_uids: uids,
    },
  });

  const mapper = (d) => {
    const collectableItemGroup = collectables.data.find(c => c.itemId === d.uid);
    if (collectableItemGroup) {
      d.collections = collectableItemGroup.collections;
    }
    return d;
  };

  if (Array.isArray(context.result)) {
    context.result = context.result.map(mapper);
  } else if (context.result.data) {
    context.result.data = context.result.data.map(mapper);
  } else if (context.result) {
    context.result = mapper(context.result);
  }
};


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
