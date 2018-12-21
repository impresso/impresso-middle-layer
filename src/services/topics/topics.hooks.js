const {
  queryWithCommonParams, // validate, utils, REGEX_UID,
  validate,
  REGEX_UID,
} = require('../../hooks/params');

module.exports = {
  before: {
    all: [],
    find: [
      validate({
        model: {
          required: false,
          regex: REGEX_UID,
        },
      }, 'GET'),
      queryWithCommonParams(),
    ],
    get: [],
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
