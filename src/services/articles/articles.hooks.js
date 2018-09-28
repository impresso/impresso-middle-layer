// const { authenticate } = require('@feathersjs/authentication').hooks;
const {
  validate, validateEach, queryWithCommonParams, displayQueryParams, REGEX_UIDS,
} = require('../../hooks/params');
const { assignIIIF } = require('../../hooks/iiif');


module.exports = {
  before: {
    all: [

    ], // authenticate('jwt') ],
    find: [
      validate({
        q: {
          required: false,
          min_length: 2,
          max_length: 1000,
        },
        order_by: {
          choices: ['-date', 'date', '-relevance', 'relevance'],
        },
      }),
      validateEach('filters', {
        context: {
          choices: ['include', 'exclude'],
          required: true,
        },
        type: {
          choices: ['string', 'entity', 'issue', 'newspaper'],
          required: true,
        },
        uid: {
          regex: REGEX_UIDS,
          required: false,
          // we cannot transform since Mustache is render the filters...
          // transform: d => d.split(',')
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
    all: [

    ],
    find: [
      assignIIIF('pages', 'issue'),
      displayQueryParams(['filters']),
    ],
    get: [
      assignIIIF('pages', 'issue', 'regions'),
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
