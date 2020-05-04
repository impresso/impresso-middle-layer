const { authenticate } = require('../../hooks/authenticate');
const { validateWithSchema } = require('../../hooks/schema');

module.exports = {
  before: {
    all: [],
    find: [
      authenticate('jwt', {
        allowUnauthenticated: true,
      }),
    ],
    get: [
      authenticate('jwt', {
        allowUnauthenticated: true,
      }),
    ],
    create: [],
    update: [],
    patch: [],
    remove: [],
  },

  after: {
    all: [],
    find: [
      validateWithSchema('services/text-reuse-clusters/schema/find/response.json', 'result'),
    ],
    get: [
      validateWithSchema('services/text-reuse-clusters/schema/get/response.json', 'result'),
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
