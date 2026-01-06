import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { readFileSync } from 'fs'
import Ajv from 'ajv'
import addFormats from 'ajv-formats'

const ajv = new Ajv({ allErrors: true, strict: true })
addFormats(ajv)

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const __parentDirname = dirname(__dirname)

// Helper function to load JSON schemas
const loadSchema = (relativePath) => {
  const fullPath = join(__parentDirname, relativePath)
  return JSON.parse(readFileSync(fullPath, 'utf-8'))
}

ajv.addSchema(loadSchema('schema/common/pagination.json'))
ajv.addSchema(loadSchema('schema/search/filter.json'))

// models
ajv.addSchema(loadSchema('schema/models/base-user.model.json'))
ajv.addSchema(loadSchema('schema/models/search-query.model.json'))
ajv.addSchema(loadSchema('schema/models/text-reuse/passage.json'))
ajv.addSchema(loadSchema('schema/models/text-reuse/cluster.json'))
ajv.addSchema(loadSchema('schema/models/text-reuse/clusterDetails.json'))

// services
ajv.addSchema(loadSchema('services/entities/schema/find/query.json'))
ajv.addSchema(loadSchema('services/search-queries/schema/post/payload.json'))
ajv.addSchema(loadSchema('services/search-queries-comparison/schema/post/payload.json'))
ajv.addSchema(loadSchema('services/search-queries-comparison/schema/post/response.json'))
ajv.addSchema(loadSchema('services/articles-text-reuse-passages/schema/find/response.json'))
ajv.addSchema(loadSchema('services/ngram-trends/schema/post/payload.json'))
ajv.addSchema(loadSchema('services/ngram-trends/schema/post/response.json'))
ajv.addSchema(loadSchema('services/me/schema/post/payload.json'))
ajv.addSchema(loadSchema('services/text-reuse-clusters/schema/find/response.json'))
ajv.addSchema(loadSchema('services/text-reuse-clusters/schema/get/response.json'))
ajv.addSchema(loadSchema('services/text-reuse-cluster-passages/schema/find/response.json'))
ajv.addSchema(loadSchema('services/articles-search/schema/create/payload.json'))
ajv.addSchema(loadSchema('services/entities-suggestions/schema/create/payload.json'))
ajv.addSchema(loadSchema('services/entities-suggestions/schema/create/response.json'))
ajv.addSchema(loadSchema('services/entity-mentions-timeline/schema/create/payload.json'))
ajv.addSchema(loadSchema('services/entity-mentions-timeline/schema/create/response.json'))
ajv.addSchema(loadSchema('services/feedback-collector/schema/create/payload.json'))

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
