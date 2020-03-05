const { protect } = require('@feathersjs/authentication-local').hooks;
const { BadRequest } = require('@feathersjs/errors');
const { includes, get, assignIn } = require('lodash');
const {
  validate, queryWithCommonParams, utils, sanitize,
} = require('../../hooks/params');
const { authenticate } = require('../../hooks/authenticate');
const { paramsValidator, eachFilterValidator } = require('../search/search.validators');
const { validateWithSchema } = require('../../hooks/schema');
const { SolrMappings } = require('../../data/constants');

const SupportedComparisonMethods = ['intersection'];

const validateComparisonMethod = (context) => {
  const { method = '' } = context.params.query;

  if (!includes(SupportedComparisonMethods, method)) {
    throw new BadRequest(`Unknown comparison method: "${method}". Should be one of: ${SupportedComparisonMethods.join(', ')}`);
  }
  return context;
};

const validateQueries = (context) => {
  const queries = get(context.data, 'queries', []);
  if (queries.length < 2) throw new BadRequest('At least two queries must be specified');

  const sanitizedQueries = queries.map(({ filters = [] }, idx) => {
    if (filters.length < 1) throw new BadRequest(`At least one filter is required in query ${idx}`);
    return {
      filters: filters.map(f => sanitize(f, eachFilterValidator)),
    };
  });

  context.data.sanitized = assignIn({}, context.data.sanitized, { queries: sanitizedQueries });
};

module.exports = {
  before: {
    create: [
      authenticate('jwt', {
        allowUnauthenticated: true,
      }),
      validateWithSchema('services/search-queries-comparison/schema/post/payload.json'),
      validateComparisonMethod,
      queryWithCommonParams(false, 'POST'),
      validate({
        order_by: paramsValidator.order_by,
        group_by: {
          ...paramsValidator.group_by,
          required: false,
          choices: ['articles'],
        },
        facets: utils.facets({
          values: SolrMappings.search.facets,
        }),
      }, 'POST'),
      validateQueries,
    ],
  },

  after: {
    create: [
      protect('content'),
    ],
  },
};
