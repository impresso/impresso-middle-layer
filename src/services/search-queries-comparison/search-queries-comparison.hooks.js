const { authenticate } = require('@feathersjs/authentication').hooks;
const { protect } = require('@feathersjs/authentication-local').hooks;
const { BadRequest } = require('@feathersjs/errors');
const { includes } = require('lodash');
const { validate, queryWithCommonParams } = require('../../hooks/params');
const { paramsValidator } = require('../search/search.validators');

const SupportedComparisonMethods = ['intersection'];

const validateComparisonMethod = async (context) => {
  const { method = '' } = context.params.query;

  if (!includes(SupportedComparisonMethods, method)) {
    throw new BadRequest(`Unknown comparison method: "${method}". Should be one of: ${SupportedComparisonMethods.join(', ')}`);
  }
  return context;
};

module.exports = {
  before: {
    create: [
      authenticate('jwt', {
        allowUnauthenticated: true,
      }),
      validateComparisonMethod,
      queryWithCommonParams(false),
      validate({
        order_by: paramsValidator.order_by,
        group_by: {
          ...paramsValidator.group_by,
          required: false,
          choices: ['articles'],
        },
      }, 'POST'),
    ],
  },

  after: {
    create: [
      protect('content'),
    ],
  },
};
