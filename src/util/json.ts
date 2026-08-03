import type { ErrorObject } from 'ajv'
import formatsPlugin from 'ajv-formats'
import { Ajv2019 as Ajv } from 'ajv/dist/2019.js'
import { readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

export type SchemaIdPair = [string, string]

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const __parentDirname = dirname(__dirname)

// Helper function to load JSON schemas
const loadSchema = (relativePath: string) => {
  const fullPath = join(__parentDirname, relativePath)
  return JSON.parse(readFileSync(fullPath, 'utf-8'))
}

export const newAjvInstance = (schemas: SchemaIdPair[]) => {
  const ajv = new Ajv({ allErrors: true, strict: true })
  formatsPlugin.default(ajv)
  for (const [schema, id] of schemas) {
    ajv.addSchema(loadSchema(schema), id)
  }
  return ajv
}

const BaseSchemaURI = 'https://github.com/impresso/impresso-middle-layer/tree/master/src'

function validated(obj: any, schemaUri: string, ajvInstance: Ajv) {
  // const uri = schemaUri?.startsWith('http') ? schemaUri : `${BaseSchemaURI}/${schemaUri}`
  const uri = schemaUri
  const validate = ajvInstance.getSchema(uri)

  if (validate === undefined) {
    throw new Error(`No such schema found: ${uri}`)
  }

  const isValid = validate(obj)
  if (!isValid) {
    const error = new Error(`JSON validation errors: ${ajvInstance.errorsText(validate.errors)}`) as Error & {
      errors?: ErrorObject[]
    }
    error.errors = validate.errors ?? undefined
    throw error
  }
  return obj
}

function formatValidationErrors(errors: (ErrorObject & { dataPath?: string })[] | null | undefined) {
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
      if (error.keyword === 'pattern') {
        const schemaPath = error.schemaPath?.startsWith('#') ? error.schemaPath?.slice(1) : error.schemaPath
        const propertyNameFromSchemaPath = schemaPath?.match(/\/properties\/([^/]+)\//)?.[1]
        return [propertyNameFromSchemaPath, `does not match pattern: ${error.params.pattern}`]
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

export { formatValidationErrors, validated }
