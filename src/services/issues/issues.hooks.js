const { sanitize } = require('../../hooks/validator');
const { normalize, finalize, finalizeMany } = require('../../hooks/neo4j');

module.exports = {
  before: {
    all: [
      sanitize()
    ],
    find: [],
    get: [],
    create: [],
    update: [],
    patch: [],
    remove: []
  },

  after: {
    all: [
      normalize()
    ],
    find: [
      finalizeMany()
    ],
    get: [
      finalize()
    ],
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