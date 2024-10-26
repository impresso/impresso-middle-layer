const Ajv = require('ajv')

const ajv = new Ajv({ allErrors: true, strict: true })
const BaseSchemaURI = 'https://github.com/impresso/impresso-public-api/tree/master/src/schema'

ajv.addSchema(require('../schema/filter.json'))
ajv.addSchema(require('../schema/filters.json'))
ajv.addSchema(require('../schema/find.json'))
ajv.addSchema(require('../schema/addons.json'))

function validated(obj, schemaUri) {
  const uri = schemaUri?.startsWith('http') ? schemaUri : `${BaseSchemaURI}/${schemaUri}`
  const validate = ajv.getSchema(uri)

  if (validate === undefined) {
    throw new Error(`No such schema found: ${uri}`)
  }
  const isValid = validate(obj)
  if (!isValid) {
    const error = new Error(`JSON validation errors: ${ajv.errorsText(validate.errors)}`)
    error.errors = validate.errors
    throw error
  }
  return obj
}

/**
 *
 * Usage example in BadRequest:
 * ```
 * throw new BadRequest('Invalid Parameters', formatValidationErrors([ <JSONSchemaError>])
 * @param {Array} errors
 * @returns {Object}
 */
function formatValidationErrors(errors = []) {
  return errors.reduce((acc, error) => {
    if (!Array.isArray(acc[error.keyword])) {
      acc[error.keyword] = []
    }
    acc[error.keyword].push(error)
    // acc[error.keyword]
    return acc
  }, {})
}

module.exports = {
  validated,
  formatValidationErrors,
}
