import Ajv from 'ajv'
import addFormats from 'ajv-formats'

const ajv = new Ajv({ allErrors: true, strict: true })
addFormats(ajv)

ajv.addSchema(require('../schema/common/pagination.json'))
ajv.addSchema(require('../schema/search/filter.json'))

// models
ajv.addSchema(require('../schema/models/base-user.model.json'))
ajv.addSchema(require('../schema/models/search-query.model.json'))
ajv.addSchema(require('../schema/models/text-reuse/passage.json'))
ajv.addSchema(require('../schema/models/text-reuse/cluster.json'))
ajv.addSchema(require('../schema/models/text-reuse/clusterDetails.json'))

// services
ajv.addSchema(require('../services/entities/schema/find/query.json'))
ajv.addSchema(require('../services/search-queries/schema/post/payload.json'))
ajv.addSchema(require('../services/search-queries-comparison/schema/post/payload.json'))
ajv.addSchema(require('../services/search-queries-comparison/schema/post/response.json'))
ajv.addSchema(require('../services/articles-text-reuse-passages/schema/find/response.json'))
ajv.addSchema(require('../services/ngram-trends/schema/post/payload.json'))
ajv.addSchema(require('../services/ngram-trends/schema/post/response.json'))
ajv.addSchema(require('../services/me/schema/post/payload.json'))
ajv.addSchema(require('../services/text-reuse-clusters/schema/find/response.json'))
ajv.addSchema(require('../services/text-reuse-clusters/schema/get/response.json'))
ajv.addSchema(require('../services/text-reuse-cluster-passages/schema/find/response.json'))
ajv.addSchema(require('../services/articles-search/schema/create/payload.json'))
ajv.addSchema(require('../services/entities-suggestions/schema/create/payload.json'))
ajv.addSchema(require('../services/entities-suggestions/schema/create/response.json'))
ajv.addSchema(require('../services/entity-mentions-timeline/schema/create/payload.json'))
ajv.addSchema(require('../services/entity-mentions-timeline/schema/create/response.json'))
ajv.addSchema(require('../services/feedback-collector/schema/create/payload.json'))

const BaseSchemaURI = 'https://github.com/impresso/impresso-middle-layer/tree/master/src'

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

function formatValidationErrors(errors) {
  return (errors || [])
    .map(error => {
      const dataPath = error.dataPath?.startsWith('.') ? error.dataPath?.slice(1) : error.dataPath

      if (error.keyword === 'additionalProperties') {
        const currentPath = dataPath
          ? `${dataPath}.${error.params.additionalProperty}`
          : error.params.additionalProperty
        return [currentPath, 'unexpected additional property']
      }
      if (error.keyword === 'required') {
        const currentPath = dataPath ? `${dataPath}.${error.params.missingProperty}` : error.params.missingProperty
        return [currentPath, 'missing required property']
      }

      if (error.keyword === 'propertyNames') {
        return undefined // this will be covered by next error
      }
      if (error.propertyName !== undefined) {
        return [`${dataPath}['${error.propertyName}']`, `invalid property name: ${error.message}`]
      }
      return [dataPath, error.message]
    })
    .filter(e => e !== undefined)
}

export { validated, formatValidationErrors }
