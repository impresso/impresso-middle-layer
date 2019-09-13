const { get } = require('lodash');
const { BadRequest } = require('@feathersjs/errors');
const { validated, formatValidationErrors } = require('../util/json');

/**
 * Validate context aspect with schema.
 */
const validateWithSchema = (schemaUri, objectPath = 'data') => (context) => {
  try {
    validated(get(context, objectPath), schemaUri);
    return context;
  } catch (e) {
    throw new BadRequest(e.message, formatValidationErrors(e.errors));
  }
};

module.exports = {
  validateWithSchema,
};
