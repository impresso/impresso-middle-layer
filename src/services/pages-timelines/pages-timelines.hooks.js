const { validate, REGEX_UID } = require('../../hooks/params');
const { checkCachedContents, returnCachedContents, saveResultsInCache } = require('../../hooks/redis');

module.exports = {
  before: {
    all: [
      checkCachedContents({
        useAuthenticatedUser: false,
      }),
    ],
    find: [

    ],
    get: [
      validate({
        newspaper_uid: {
          required: false,
          regex: REGEX_UID,
        },
      }),
    ],
    create: [],
    update: [],
    patch: [],
    remove: [],
  },

  after: {
    all: [
      returnCachedContents(),
      saveResultsInCache(),
    ],
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
