import { authenticate } from '@/hooks/authenticate.js'

export default {
  before: {
    all: [],
    find: [
      authenticate('jwt', {
        allowUnauthenticated: true,
      }),
    ],
    get: [],
    create: [],
    update: [],
    patch: [],
    remove: [],
  },

  after: {
    all: [],
    find: [
      // validateWithSchema('services/text-reuse-cluster-passages/schema/find/response.json', 'result'),
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
}
