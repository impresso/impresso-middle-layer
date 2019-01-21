const {
  queryWithCommonParams, // validate, utils, REGEX_UID,
  validate,
  validateEach,
  REGEX_UID,
  utils,
} = require('../../hooks/params');
const { filtersToSolrQuery, qToSolrFilter } = require('../../hooks/search');
const { checkCachedContents, returnCachedContents, saveResultsInCache } = require('../../hooks/redis');

module.exports = {
  before: {
    all: [],
    find: [
      checkCachedContents(),
      validate({
        q: {
          required: false,
          max_length: 20,
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
        facets: utils.facets({
          values: {
            topicmodel: {
              type: 'terms',
              field: 'tp_model_s',
              mincount: 0,
              limit: 100,
            },
          },
          required: false,
        }),
      }, 'GET'),
      validateEach('filters', {
        context: {
          choices: ['include', 'exclude'],
          defaultValue: 'include',
        },
        type: {
          choices: ['topicmodel', 'language', 'string'],
          required: true,
        },
        q: {
          required: true,
          min_length: 2,
          max_length: 500,
          regex: REGEX_UID,
        },
      }, {
        required: false,
      }),
      qToSolrFilter('topic-string'),
      filtersToSolrQuery('topicmodel', 'topic-string', 'language'),
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
      returnCachedContents(),
      saveResultsInCache(),
    ],
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
