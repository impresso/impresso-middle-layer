const { authenticate } = require('@feathersjs/authentication').hooks;
const { validate } = require('../../hooks/params');

module.exports = {
  before: {
    all: [
      // authenticate('jwt')
    ],
    find: [],
    get: [
      validate({
        format: {
          required: true,
          choices: ['csv'],
        },
      }),
    ],
    create: [],
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
