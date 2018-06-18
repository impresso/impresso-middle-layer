const { authenticate } = require('@feathersjs/authentication').hooks;
const { validate, REGEX_UID } = require('../../hooks/params');
const { queryWithCurrentUser } = require('feathers-authentication-hooks');

module.exports = {
  before: {
    all: [authenticate('jwt')],
    find: [],
    get: [],
    create: [
      queryWithCurrentUser({
        idField: 'uid',
        as: 'user__uid',
      }),
      validate({
        article__uid: {
          required: true,
          regex: REGEX_UID,
        },
        tag__uid: {
          required: true,
          regex: REGEX_UID,
        },
      }),
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
