const { validateWithSchema } = require('../../hooks/schema');

module.exports = {
  before: {
    all: [],
    find: [],
    get: [],
    create: [
      validateWithSchema('services/entities-mentions/schema/create/payload.json'),
    ],
    update: [],
    patch: [],
    remove: [],
  },

  after: {
    all: [],
    find: [],
    get: [],
    create: [
      validateWithSchema('services/entities-mentions/schema/create/response.json', 'result'),
    ],
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
