const { sanitize } = require('../../hooks/params');

module.exports = {
  before: {
    all: [
      sanitize()
    ]
  },

  after: {
    all: [],
    find: [],
    get: []
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
