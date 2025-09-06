import { HookContext } from '@feathersjs/feathers'

import { hooks } from '@feathersjs/authentication'
import { queryWithCommonParams, validate, validateEach, utils, REGEX_UID, REGEX_UIDS } from '../../hooks/params'

const { authenticate } = hooks

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
        if (context.params.route?.collection_id) {
          context.params.query.collection_uid = context.params.route.collection_id
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
}
