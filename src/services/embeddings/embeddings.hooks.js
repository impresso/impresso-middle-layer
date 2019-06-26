const { queryWithCommonParams, validate } = require('../../hooks/params');

module.exports = {
  before: {
    all: [],
    find: [
      validate({
        language: {
          choices: ['fr', 'de', 'en'],
        },
        q: {
          required: true,
          regex: /^[A-zÀ-ÿ]+$/,
          max_length: 500,
          transform: d => d.toLowerCase(),
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
