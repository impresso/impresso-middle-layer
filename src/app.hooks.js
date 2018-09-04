// Application hooks that run for every service
const logger = require('./hooks/logger');
const { validateRouteId } = require('./hooks/params');

module.exports = {
  before: {
    all: [validateRouteId()],
    find: [],
    get: [],
    create: [],
    update: [],
    patch: [],
    remove: [],
  },

  after: {
    all: [logger()],
    find: [],
    get: [],
    create: [],
    update: [],
    patch: [],
    remove: [],
  },

  error: {
    all: [logger()],
    find: [],
    get: [],
    create: [],
    update: [],
    patch: [],
    remove: [],
  },
};
