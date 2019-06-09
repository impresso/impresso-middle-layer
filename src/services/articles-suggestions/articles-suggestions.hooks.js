const { authenticate } = require('@feathersjs/authentication').hooks;
const { queryWithCommonParams, validate } = require('../../hooks/params');

module.exports = {
  before: {
    all: [authenticate('jwt')],
    find: [
    ],
    get: [
      // give article id, we should provide the correct method
      validate({
        method: {
          choices: ['topics'],
          defaultValue: 'topics',
        },
      }),
      queryWithCommonParams(),

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
