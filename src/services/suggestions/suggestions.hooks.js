const { queryWithCommonParams, validate } = require('../../hooks/params');


module.exports = {
  before: {
    all: [
      queryWithCommonParams(false)
    ],
    find: [
      validate({
        q: {
          required: true,
          min_length: 2,
          max_length: 1000
        }
      })
    ],
  },

  after: {
    all: [],
    find: [],
    get: [],
    create: [],
    update: [],
    patch: [],
    remove: []
  },

  error: {
    all: [

    ],
    find: [],
    get: [],
    create: [],
    update: [],
    patch: [],
    remove: []
  }
};
