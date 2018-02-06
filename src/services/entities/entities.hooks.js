const { authenticate } = require('@feathersjs/authentication').hooks;
const { sanitize } = require('../../hooks/params');

module.exports = {
  before: {
    all: [ 
      sanitize()
    ],//authenticate('jwt') ],
    find: [],
    get: [],
    create: [],
    update: [],
    patch: [],
    remove: []
  },

  after: {
    all: [
      // normalize()
    ],
    find: [
      // finalizeMany()
    ],
    get: [
      // finalize()
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
