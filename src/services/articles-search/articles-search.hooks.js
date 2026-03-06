import { validateWithSchema } from '@/hooks/schema.js'
import { newAjvInstance } from '@/util/json.js'
import { authenticate } from '@/hooks/authenticate.js'

const validationInstance = newAjvInstance([
  ['schema/canonical/Filter.json', 'schema/canonical/Filter.json'],
  ['services/articles-search/schema/create/payload.json', 'request'],
])

export default {
  before: {
    all: [],
    find: [],
    get: [],
    create: [
      validateWithSchema('request', validationInstance),
      authenticate('jwt', {
        allowUnauthenticated: true,
      }),
    ],
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
