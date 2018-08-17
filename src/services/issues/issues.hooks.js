const { queryWithCommonParams } = require('../../hooks/params');
const { assignIIIF } = require('../../hooks/iiif');

module.exports = {
  before: {
    all: [
      queryWithCommonParams(),
    ],
    find: [],
    get: [],
    create: [],
    update: [],
    patch: [],
    remove: [],
  },

  after: {
    all: [],
    find: [],
    get: [
      // change count_pages
      assignIIIF('pages'),
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
