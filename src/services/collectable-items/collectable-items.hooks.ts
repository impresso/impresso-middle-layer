import { HookContext } from '@feathersjs/feathers'

const { authenticate } = require('@feathersjs/authentication').hooks
const { queryWithCommonParams, validate, validateEach, utils, REGEX_UID, REGEX_UIDS } = require('../../hooks/params')

const { resolve } = require('../../hooks/results')

const reconcile = () => (context: HookContext) => {
  if (!context.result.resolved) {
    return
  }

  const collections = context.result.resolved.find((d: { service: string }) => d.service === 'collections')

  if (!collections || !collections.data || !collections.data.length) {
    return
  }

  // fill CollectableItemGroup.collections
  context.result.data = context.result.data.map((d: any) => {
    // clean collections
    d.collections = []
    collections.data.forEach((coll: { uid: string }) => {
      if (d.collectionIds.indexOf(coll.uid) !== -1) {
        d.collections.push(coll)
      }
    })
    return d
  })

  const articles = context.result.resolved.find((d: any) => d.service === 'articles')

  if (!articles || !articles.data || !articles.data.length) {
    return
  }

  // fill CollectableItemGroup.collections
  context.result.data = context.result.data.map((d: { item: any; itemId: string }) => {
    // add item
    d.item = articles.data.find((art: { uid: string }) => art.uid === d.itemId)
    return d
  })
}

export default {
  before: {
    all: [authenticate('jwt')],
    find: [
      validate(
        {
          collection_uids: {
            required: false,
            regex: REGEX_UIDS,
            after: (d: any) => (Array.isArray(d) ? d : d.split(',')),
          },
          item_uids: {
            required: false,
            regex: REGEX_UIDS,
            after: (d: any) => (Array.isArray(d) ? d : d.split(',')),
          },
          resolve: {
            choices: ['collection', 'item'],
            defaultValue: 'collection',
          },
          order_by: {
            choices: ['-dateAdded', 'dateAdded', '-itemDate', 'itemDate'],
            defaultValue: '-dateAdded',
            transform: (d: any) =>
              utils.translate(d, {
                dateAdded: 'latestDateAdded ASC',
                '-dateAdded': 'latestDateAdded DESC',
                itemDate: 'itemDate ASC',
                '-itemdate': 'itemDate DESC',
              }),
          },
        },
        'GET'
      ),
      queryWithCommonParams(),
    ],
    get: [],
    create: [
      validate(
        {
          collection_uid: {
            required: true,
            regex: REGEX_UID,
          },
        },
        'POST'
      ),
      validateEach(
        'items',
        {
          content_type: {
            choices: ['article', 'entity', 'page', 'issue'],
            required: true,
            transform: (d: any) =>
              utils.translate(d, {
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
        },
        {
          required: true,
          method: 'POST',
        }
      ),
    ],
    update: [],
    patch: [
      // in nested endpoint, map collectionId to a query parameter
      (context: HookContext) => {
        if (context.params.route?.id) {
          context.params.query.collection_id = context.params.route.id
        }
      },
    ],
    remove: [
      validate(
        {
          collection_uid: {
            required: true,
            regex: REGEX_UID,
          },
        },
        'GET'
      ),
      validateEach(
        'items',
        {
          uid: {
            regex: REGEX_UID,
            required: true,
          },
        },
        {
          required: true,
          method: 'GET',
        }
      ),
    ],
  },

  after: {
    all: [],
    find: [resolve(), reconcile()],
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
}
