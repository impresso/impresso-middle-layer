const { queryWithCurrentUser } = require('feathers-authentication-hooks');
const { queryWithCommonParams } = require('../../hooks/params');
const { proxyIIIF } = require('../../hooks/iiif');

module.exports = {
  before: {
    all: [

    ],
    find: [
      queryWithCommonParams(),
    ],
    get: [
      queryWithCommonParams(),
    ],
    create: [],
    update: [],
    patch: [],
    remove: [],
  },

  after: {
    all: [],
    find: [
      proxyIIIF(),
    ],
    get: [
      proxyIIIF(),
    ],
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
