// const { authenticate } = require('@feathersjs/authentication').hooks;
const {
  queryWithCommonParams,
} = require('../../hooks/params');


module.exports = {
  before: {
    all: [],
    find: [
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
