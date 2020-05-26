const { authenticate } = require('../../hooks/authenticate');
const { queryWithCommonParams, validate } = require('../../hooks/params');

module.exports = {
  before: {
    all: [
      authenticate('jwt', {
        allowUnauthenticated: true,
      }),
    ],
    find: [
      validate({
        // we do not use transform here; it will be used to computate different things.
        q: {
          required: true,
          min_length: 2,
          max_length: 1000,
        },
      }),
      queryWithCommonParams(),
    ],
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
    all: [

    ],
    find: [],
    get: [],
    create: [],
    update: [],
    patch: [],
    remove: [],
  },
};
