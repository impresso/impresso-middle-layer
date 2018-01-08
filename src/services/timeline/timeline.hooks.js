const { authenticate } = require('@feathersjs/authentication').hooks;
const { normalizeTimeline } = require('../../hooks/neo4j');

module.exports = {
  before: {
    all: [],// authenticate('jwt') ],
    find: [],
    get: [],
    create: [],
    update: [],
    patch: [],
    remove: []
  },

  after: {
    all: [
      normalizeTimeline()
    ],
    find: [],
    get: [],
    create: [],
    update: [],
    patch: [],
    remove: []
  },

  error: {
    all: [],
    find: [],
    get: [],
    create: [],
    update: [],
    patch: [],
    remove: []
  }
};
