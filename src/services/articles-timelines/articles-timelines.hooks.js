import { validate, validateEach, queryWithCommonParams, REGEX_UID } from '../../hooks/params'
import { filtersToSolrQuery } from '../../hooks/search'

export default {
  before: {
    all: [],
    find: [],
    get: [
      validate({}),
      validateEach(
        'filters',
        {
          type: {
            choices: ['uid', 'issue', 'page', 'newspaper', 'topic'],
            required: true,
          },
          q: {
            regex: REGEX_UID,
            required: true,
            // we cannot transform since Mustache is render the filters...
            // transform: d => d.split(',')
          },
        },
        {
          required: false,
        }
      ),
      filtersToSolrQuery(),
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
