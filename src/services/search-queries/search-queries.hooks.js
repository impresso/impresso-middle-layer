import { hooks } from '@feathersjs/authentication'
import { validateWithSchema } from '../../hooks/schema'
import { queryWithCommonParams } from '../../hooks/params'

const { authenticate } = hooks

export default {
  before: {
    all: [authenticate('jwt')],
    find: [queryWithCommonParams()],
    get: [],
    create: [validateWithSchema('services/search-queries/schema/post/payload.json')],
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
