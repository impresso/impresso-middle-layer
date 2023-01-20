const { authenticate } = require('@feathersjs/authentication').hooks;
const { queryWithCurrentUser } = require('feathers-authentication-hooks');
const { normalizeEmptyRecords, raiseErrorIfEmpty, parseJsonProperty } = require('../../hooks/neo4j');
const { validate, queryWithCommonParams, REGEX_SLUG } = require('../../hooks/params');

module.exports = {
  before: {
    all: [
      authenticate('jwt'),

      queryWithCommonParams(),

      queryWithCurrentUser({
        idField: 'uid',
        as: 'user__uid',
      }),
    ],
    find: [],
    get: [],
    create: [
      validate({
        name: {
          required: true,
          max_length: 100,
        },
        data: {
          required: true,
          max_length: 2000,
          fn: (d) => {
            if (typeof d !== 'object') { return false; }
            return true;
          },
          transform: d => JSON.stringify(d),
        },
        parent__uid: {
          required: false,
          regex: REGEX_SLUG,
        },
      }),
    ],
    update: [],
    patch: [],
    remove: [],
  },

  after: {
    all: [],
    find: [
      normalizeEmptyRecords(),
      parseJsonProperty(),
    ],
    get: [
      parseJsonProperty(),
    ],
    create: [
      raiseErrorIfEmpty({
        explanation: 'Can\'t create query object, please check your parent__uid value',
      }),
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
