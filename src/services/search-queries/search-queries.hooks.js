const { authenticate } = require('@feathersjs/authentication').hooks;
const { validateWithSchema } = require('../../hooks/schema');
const { queryWithCommonParams } = require('../../hooks/params');

module.exports = {
  before: {
    all: [
      authenticate('jwt'),
    ],
    find: [
      queryWithCommonParams(),
    ],
    get: [],
    create: [
      validateWithSchema('services/search-queries/schema/post/payload.json'),
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
