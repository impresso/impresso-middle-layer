const { queryWithCommonParams, validate, utils } = require('../../hooks/params');


module.exports = {
  before: {
    all: [

    ],
    find: [
      validate({
        q: {
          required: true,
          min_length: 2,
          max_length: 1000,
          transform: utils.toLucene,
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
