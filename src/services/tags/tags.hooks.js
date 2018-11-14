const { authenticate } = require('@feathersjs/authentication').hooks;
const { validate, queryWithCommonParams, utils } = require('../../hooks/params');

module.exports = {
  before: {
    all: [],
    find: [
      validate({
        q: {
          required: false,
          min_length: 2,
          max_length: 100,
          transform: utils.toLucene,
        },
      }),
      queryWithCommonParams(),
    ],
    get: [],
    create: [
      authenticate('jwt'), // and is staff
    ],
    update: [
      authenticate('jwt'), // and is staff
    ],
    patch: [
      authenticate('jwt'), // and is staff
    ],
    remove: [
      authenticate('jwt'), // and is staff
    ],
  },

  after: {
    all: [],
    find: [],
    get: [],
    create: [

    ],
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
