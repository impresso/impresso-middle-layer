const { queryWithCommonParams, validate, utils } = require('../../hooks/params');

module.exports = {
  before: {
    all: [

    ],
    find: [
      validate({
        q: {
          required: false,
          max_length: 500,
          transform: d => utils.toSequelizeLike(d),
        },
      }),
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
