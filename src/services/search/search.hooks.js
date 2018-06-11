const { validate, validateEach, queryWithCommonParams, displayQueryParams, REGEX_UIDS, utils} = require('../../hooks/params');
const { proxyIIIF } = require('../../hooks/iiif');


module.exports = {
  before: {
    all: [],
    find: [
      validate({
        q: {
          required: true,
          min_length: 2,
          max_length: 1000,
          transform: utils.toLucene,
        },
        group_by: {
          required: true,
          choices: ['articles', 'pages'],
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
          choices: ['string', 'entity', 'newspaper'],
          required: true,
        },
        uids: {
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
    remove: []
  },

  after: {
    all: [],
    find: [
      proxyIIIF(),
      displayQueryParams(['q', 'filters']),
    ],
    get: [],
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
