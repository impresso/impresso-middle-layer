const {
  queryWithCommonParams, // validate, utils, REGEX_UID,
  validate,
  validateEach,
  // REGEX_UID,
  utils,
} = require('../../hooks/params')
const { filtersToSolrQuery } = require('../../hooks/search')
const { eachFilterValidator } = require('../search/search.validators')

export default {
  before: {
    all: [],
    find: [
      validate({
        q: {
          required: false,
          min_length: 1,
          max_length: 50,
        },
        order_by: utils.orderBy({
          values: {
            name: 'word_probs_dpf ASC',
            '-name': 'word_probs_dpf DESC',
            model: 'tp_model_s ASC',
            '-model': 'tp_model_s DESC',
          },
          defaultValue: 'name',
        }),
      }),
      validateEach('filters', eachFilterValidator),
      filtersToSolrQuery({
        overrideOrderBy: false,
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
}
