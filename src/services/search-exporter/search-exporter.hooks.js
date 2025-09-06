const { authenticate } = require('@feathersjs/authentication').hooks
const { validate, validateEach, queryWithCommonParams, REGEX_UID, REGEX_UIDS, utils } = require('../../hooks/params')
const { filtersToSolrQuery } = require('../../hooks/search')
const { FilterTypes, Contexts, SolrMappings } = require('../../data/constants')

const { eachFilterValidator, paramsValidator } = require('../search/search.validators')

export default {
  before: {
    all: [
      authenticate('jwt'),
      validate({
        format: {
          required: true,
          choices: ['csv', 'text/plain'],
        },
      }),
    ],
    find: [
      validate({
        q: {
          required: false,
          min_length: 2,
          max_length: 1000,
        },
        group_by: {
          required: true,
          choices: ['articles'],
        },
        order_by: {
          before: d => {
            if (typeof d === 'string') {
              return d.split(',')
            }
            return d
          },
          choices: ['-date', 'date', '-relevance', 'relevance'],
          transform: d => utils.toOrderBy(d, SolrMappings.search.orderBy, true),
          after: d => {
            if (Array.isArray(d)) {
              return d.join(',')
            }
            return d
          },
        },
      }),
      validateEach(
        'filters',
        {
          context: {
            choices: Contexts,
            required: true,
          },
          type: {
            choices: FilterTypes,
            required: true,
          },
          q: {
            required: false,
            min_length: 2,
            max_length: 500,
          },
          // compatible only with type daterange, unused elsewhere.
          // If it is an array, an OR will be used to JOIN the array items..
          // ex: ['* TO 1950-12-01', '1960-01-01 TO 1940-12-01']
          // q= ... AND (date_e:[* TO 1950-12-01] OR date_s:[1960-01-01 TO 1940-12-01])
          daterange: {
            regex: /(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z) TO (\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z)/,
            required: false,
          },

          uids: {
            regex: REGEX_UIDS,
            required: false,
            // we cannot transform since Mustache is rendering the filters...
            // transform: d => d.split(',')
          },
          uid: {
            regex: REGEX_UID,
            required: false,
            // we cannot transform since Mustache is rendering the filters...
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

    create: [
      validate(
        {
          description: {
            required: false,
            min_length: 2,
            max_length: 1000,
          },
          taskname: {
            required: false,
            choices: ['export_query_as_csv', 'export_collection_as_csv'],
            defaultValue: 'export_query_as_csv',
          },
        },
        'POST'
      ),

      validate(
        {
          ...paramsValidator,
        },
        'GET'
      ),
      validateEach('filters', eachFilterValidator),
      filtersToSolrQuery(),
      queryWithCommonParams(),
    ],
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
