const { queryWithCommonParams, validate } = require('../../hooks/params');

module.exports = {
  before: {
    all: [],
    find: [
      validate({
        language: {
          choices: ['fr', 'de', 'lb'],
        },
        q: {
          required: true,
          regex: /^[A-zÀ-ÿ'()\s]+$/,
          max_length: 500,
          transform: d => d.replace(/[^A-zÀ-ÿ]/g, ' ')
            .toLowerCase().split(/\s+/)
            .sort((a, b) => a.length - b.length)
            .pop(),
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
