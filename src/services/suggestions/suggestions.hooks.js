const { authenticate } = require('../../hooks/authenticate');
const { queryWithCommonParams, validate } = require('../../hooks/params');
const { checkCachedContents, saveResultsInCache, returnCachedContents } = require('../../hooks/redis');


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
      checkCachedContents({
        cacheUnauthenticated: false,
        useAuthenticatedUser: true,
      }),
    ],
  },

  after: {
    all: [],
    find: [
      returnCachedContents(),
      saveResultsInCache(),
    ],
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
