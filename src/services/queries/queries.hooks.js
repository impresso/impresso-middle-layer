const { authenticate } = require('@feathersjs/authentication').hooks;
const { queryWithCurrentUser } = require('feathers-authentication-hooks');
const {normalizeEmptyRecords} = require('../../hooks/neo4j');

module.exports = {
  before: {
    all: [
      authenticate('jwt'),
      queryWithCurrentUser({
        idField: 'uid',
        as: 'user__uid'
      })
    ],
    find: [],
    get: [],
    create: [

    ],
    update: [],
    patch: [],
    remove: []
  },

  after: {
    all: [],
    find: [
      normalizeEmptyRecords()
    ],
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
