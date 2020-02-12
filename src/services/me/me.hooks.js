const { authenticate } = require('@feathersjs/authentication').hooks;
const { discard } = require('feathers-hooks-common');
const { REGEX_PASSWORD, validate } = require('../../hooks/params');

module.exports = {
  before: {
    all: [authenticate('jwt')],
    find: [],
    get: [],
    create: [],
    update: [],
    patch: [
      validate({
        previousPassword: {
          required: false,
          regex: REGEX_PASSWORD,
        },
        newPassword: {
          required: false,
          regex: REGEX_PASSWORD,
        },
      }, 'POST'),
    ],
    remove: [],
  },

  after: {
    all: [discard('password')],
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
