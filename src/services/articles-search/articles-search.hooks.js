import { validateWithSchema } from '@/hooks/schema.js'
import { authenticate } from '@/hooks/authenticate.js'

export default {
  before: {
    all: [],
    find: [],
    get: [],
    create: [
      validateWithSchema('services/articles-search/schema/create/payload.json'),
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
