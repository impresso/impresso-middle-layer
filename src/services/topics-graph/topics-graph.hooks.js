const { eachFilterValidator } = require('../search/search.validators')
const { validateEach, queryWithCommonParams, validate } = require('../../hooks/params')
const { filtersToSolrQuery } = require('../../hooks/search')

/**
 * A special case context validator for the 'find' endpoint here.
 */
const findEachFilterValidator = { ...eachFilterValidator }
findEachFilterValidator.context = { ...eachFilterValidator.context }
findEachFilterValidator.context.choices = eachFilterValidator.context.choices.concat[['visualize']]

module.exports = {
  before: {
    all: [],
    find: [
      validate({
        q: {
          required: false,
          min_length: 1,
          max_length: 50,
        },
        expand: {
          required: false,
          defaultValue: false,
        },
      }),
      validateEach('filters', findEachFilterValidator),
      filtersToSolrQuery({
        overrideOrderBy: false,
      }),
      queryWithCommonParams(),
    ],
    get: [
      validateEach('filters', eachFilterValidator),
      filtersToSolrQuery({
        overrideOrderBy: false,
      }),
      queryWithCommonParams(),
    ],
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
