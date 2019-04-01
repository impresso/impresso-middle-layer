// const { authenticate } = require('@feathersjs/authentication').hooks;
const { assignIIIF } = require('../../hooks/iiif');
const {
  utils, validate, queryWithCommonParams,
} = require('../../hooks/params');

module.exports = {
  before: {
    all: [
      // authenticate('jwt')
    ],
    find: [
      validate({
        order_by: utils.orderBy({
          values: {
            relevance: 'score ASC',
            '-relevance': 'score DESC',
          },
          defaultValue: 'relevance',
        }),
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
    find: [
      assignIIIF('pages', 'regions'),
    ],
    get: [
      assignIIIF('pages', 'regions'),
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
