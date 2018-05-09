const { authenticate } = require('@feathersjs/authentication').hooks;
const { queryWithCurrentUser } = require('feathers-authentication-hooks');
const { normalizeEmptyRecords, raiseErrorIfEmpty, parseJsonProperty } = require('../../hooks/neo4j');
const { validate, queryWithCommonParams, REGEX_SLUG } = require('../../hooks/params');


module.exports = {
  before: {
    all: [
      queryWithCommonParams()
    ],
    find: [],
    get: [],
    create: [
      authenticate('jwt') // and is staff
    ],
    update: [
      authenticate('jwt') // and is staff
    ],
    patch: [
      authenticate('jwt') // and is staff
    ],
    remove: [
      authenticate('jwt') // and is staff
    ]
  },

  after: {
    all: [],
    find: [],
    get: [],
    create: [

    ],
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
