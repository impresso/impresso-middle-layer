const { authenticate } = require('@feathersjs/authentication').hooks;
const {
  queryWithCommonParams, validate, validateEach, utils, REGEX_UID, REGEX_UIDS,
} = require('../../hooks/params');

const { resolve } = require('../../hooks/results');

const reconcile = () => (context) => {
  if (!context.result.resolved) {
    return;
  }

  const collections = context.result.resolved.find(d => d.service === 'collections');

  if (!collections || !collections.data || !collections.data.length) {
    return;
  }

  // fill CollectableItemGroup.collections
  context.result.data = context.result.data.map((d) => {
    // clean collections
    d.collections = [];
    collections.data.forEach((coll) => {
      if (d.collectionIds.indexOf(coll.uid) !== -1) {
        d.collections.push(coll);
      }
    });
    return d;
  });

  const articles = context.result.resolved.find(d => d.service === 'articles');

  if (!articles || !articles.data || !articles.data.length) {
    return;
  }

  // fill CollectableItemGroup.collections
  context.result.data = context.result.data.map((d) => {
    // add item
    d.item = articles.data.find(art => art.uid === d.itemId);
    return d;
  });
};

module.exports = {
  before: {
    all: [authenticate('jwt')],
    find: [
      validate({
        collection_uids: {
          required: false,
          regex: REGEX_UIDS,
          after: d => (Array.isArray(d) ? d : d.split(',')),
        },
        item_uids: {
          required: false,
          regex: REGEX_UIDS,
          after: d => (Array.isArray(d) ? d : d.split(',')),
        },
        resolve: {
          choices: ['collection', 'item'],
          defaultValue: 'collection',
        },
        order_by: {
          choices: ['-dateAdded', 'dateAdded', '-itemDate', 'itemDate'],
          defaultValue: '-dateAdded',
          transform: d => utils.translate(d, {
            dateAdded: 'latestDateAdded ASC',
            '-dateAdded': 'latestDateAdded DESC',
            itemDate: 'itemDate ASC',
            '-itemdate': 'itemDate DESC',
          }),
        },
      }, 'GET'),
      queryWithCommonParams(),
    ],
    get: [],
    create: [
      validate({
        collection_uid: {
          required: true,
          regex: REGEX_UID,
        },
      }, 'POST'),
      validateEach('items', {
        content_type: {
          choices: ['article', 'entity', 'page', 'issue'],
          required: true,
          transform: d => utils.translate(d, {
            article: 'A',
            entity: 'E',
            page: 'P',
            issue: 'I',
          }),
        },
        uid: {
          regex: REGEX_UID,
          required: true,
        },
      }, {
        required: true,
        method: 'POST',
      }),
    ],
    update: [],
    patch: [],
    remove: [
      validate({
        collection_uid: {
          required: true,
          regex: REGEX_UID,
        },
      }, 'GET'),
      validateEach('items', {
        uid: {
          regex: REGEX_UID,
          required: true,
        },
      }, {
        required: true,
        method: 'GET',
      }),
    ],
  },

  after: {
    all: [],
    find: [
      resolve(),
      reconcile(),
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
