import { hooks } from '@feathersjs/authentication'
import { validateWithSchema } from '@/hooks/schema.js'
import { queryWithCommonParams } from '@/hooks/params.js'
import { newAjvInstance } from '@/util/json.js'

const validationInstance = newAjvInstance([['services/search-queries/schema/post/payload.json', 'request']])

const { authenticate } = hooks

export default {
  before: {
    all: [authenticate('jwt')],
    find: [queryWithCommonParams()],
    get: [],
    create: [validateWithSchema('request', validationInstance)],
    update: [],
    patch: [],
    remove: [],
  },

  after: {
    all: [],
    find: [],
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
