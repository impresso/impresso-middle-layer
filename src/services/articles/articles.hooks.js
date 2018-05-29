const { authenticate } = require('@feathersjs/authentication').hooks;
const { validate, validateEach, queryWithCommonParams, displayQueryParams, REGEX_UIDS} = require('../../hooks/params');
const { proxyIIIF } = require('../../hooks/iiif');


module.exports = {
  before: {
    all: [

      validate({
        q: {
          required: false,
          min_length: 2,
          max_length: 1000
        },
        order_by: {
          choices: ['-date', 'date', '-relevance', 'relevance']
        }
      })
    ],//authenticate('jwt') ],
    find: [
      validateEach('filters', {
        context: {
          choices: ['include', 'exclude'],
          required: true,
        },
        type: {
          choices: ['String', 'NamedEntity', 'Issue', 'Newspaper'],
          required: true,
        },
        uids: {
          regex: REGEX_UIDS,
          required: false,
          // we cannot transform since Mustache is render the filters...
          // transform: d => d.split(',')
        }
      }),
      queryWithCommonParams()
    ],
    get: [],
    create: [],
    update: [],
    patch: [],
    remove: []
  },

  after: {
    all: [

    ],
    find: [
      proxyIIIF(),
      displayQueryParams(['filters']),
    ],
    get: [
    ],
    create: [],
    update: [],
    patch: [],
    remove: []
  },

  error: {
    all: [],
    find: [],
    get: [],
    create: [],
    update: [],
    patch: [],
    remove: []
  }
};
