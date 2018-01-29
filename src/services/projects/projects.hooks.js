const { sanitize } = require('../../hooks/params');
const { normalize, finalize, finalizeMany } = require('../../hooks/neo4j');

module.exports = {
  before: {
    all: [
      sanitize()
    ]
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
    ]
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
