import { hooks } from '@feathersjs/authentication'
const { validate, validateEach, REGEX_UID, queryWithCommonParams } = require('../../hooks/params')
import { assignIIIF } from '../../hooks/iiif'

const { authenticate } = hooks

export default {
  before: {
    all: [authenticate('jwt')],
    find: [
      validate(
        {
          bucket_uids: {
            required: false,
            before: d => (Array.isArray(d) ? d : d.split(',')),
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
          bucket_uid: {
            required: true,
            regex: REGEX_UID,
          },
        },
        'POST'
      ),
      validateEach(
        'items',
        {
          label: {
            choices: ['article', 'entity', 'page', 'issue'],
            required: true,
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
      queryWithCommonParams(),
    ],
    update: [],
    patch: [],
    remove: [
      validateEach(
        'items',
        {
          label: {
            choices: ['article', 'entity', 'page', 'issue'],
            required: true,
          },
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
      queryWithCommonParams(),
    ],
  },

  after: {
    all: [],
    find: [assignIIIF('pages', 'issue')],
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
