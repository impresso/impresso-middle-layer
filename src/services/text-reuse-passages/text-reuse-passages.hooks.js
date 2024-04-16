// import { GroupByValues } from './text-reuse-passages.class'
import { docs } from './text-reuse-passages.schema'
import { validateParameters } from '../../util/openapi'

const { splitId } = require('../../hooks/parameters')
// const {
// validateId,
// validateAgainstOptions,
// validatePagination,
// validateWithSchemaUri,
// } = require('../../hooks/validators')

module.exports = {
  before: {
    get: [validateParameters(docs.operations.get.parameters), splitId()],
    find: [
      validateParameters(docs.operations.find.parameters),
      // validatePagination('params.query', { max_limit: 20 }),
      // validateWithSchemaUri('params.query.addons', 'addons.json', {
      //   asJSON: true,
      //   isOptional: true,
      //   label: '"addons" query string parameter',
      //   defaultValue: {},
      // }),
      // validateWithSchemaUri('params.query.filters', 'filters.json', {
      //   asJSON: true,
      //   isOptional: true,
      //   label: '"filters" query string parameter',
      //   defaultValue: [],
      // }),
      // validateAgainstOptions('params.query.groupby', GroupByValues),
    ],
  },
}
