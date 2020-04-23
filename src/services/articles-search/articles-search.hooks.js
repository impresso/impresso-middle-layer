const { validateWithSchema } = require('../../hooks/schema');
const { authenticate } = require('../../hooks/authenticate');

module.exports = {
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
};
