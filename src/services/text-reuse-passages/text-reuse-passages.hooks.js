const { splitId } = require('../../hooks/parameters')
const {
  validateId,
  validatePagination,
  validateWithSchemaUri,
} = require('../../hooks/validators')

module.exports = {
  before: {
    get: [
      validateId(/^[A-Za-z0-9-,:@]+$/),
      splitId(),
      validateWithSchemaUri('params.query.addons', 'addons.json', {
        asJSON: true,
        isOptional: true,
        label: '"addons" query string parameter',
        defaultValue: {},
      }),
    ],
    find: [
      validatePagination('params.query', { max_limit: 20 }),
      validateWithSchemaUri('params.query.addons', 'addons.json', {
        asJSON: true,
        isOptional: true,
        label: '"addons" query string parameter',
        defaultValue: {},
      }),
      validateWithSchemaUri('params.query.filters', 'filters.json', {
        asJSON: true,
        isOptional: true,
        label: '"filters" query string parameter',
        defaultValue: [],
      }),
    ],
  },
}
