import type { ErrorObject, Options } from 'ajv'
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

// Schemas are registered under their path relative to `src/`, so that relative `$ref`s
// inside them resolve against the file system layout. The caller-provided ids are
// kept as aliases to allow looking schemas up by a short name.
const schemaIdAliases = new WeakMap<Ajv, Map<string, string>>()

export const newAjvInstance = (schemas: SchemaIdPair[], options: Options = {}) => {
  const ajv = new Ajv({ allErrors: true, strict: true, ...options })
  formatsPlugin.default(ajv)
  const aliases = new Map<string, string>()
  for (const [schema, id] of schemas) {
    if (!aliases.has(schema)) {
      ajv.addSchema(loadSchema(schema), schema)
      aliases.set(schema, schema)
    }
    aliases.set(id, schema)
  }
  schemaIdAliases.set(ajv, aliases)
  return ajv
}

function resolveSchemaId(ajvInstance: Ajv, schemaUri: string): string {
  return schemaIdAliases.get(ajvInstance)?.get(schemaUri) ?? schemaUri
}

function validated<T = unknown>(obj: unknown, schemaUri: string, ajvInstance: Ajv): T {
  const uri = resolveSchemaId(ajvInstance, schemaUri)
  const validate = ajvInstance.getSchema<T>(uri)

  if (validate === undefined) {
    throw new Error(`No such schema found: ${uri}`)
  }

  if ('$async' in validate) {
    throw new Error(`Synchronous validation requires a synchronous schema: ${uri}`)
  }

  if (!validate(obj)) {
    const error = Object.assign(new Error(`JSON validation errors: ${ajvInstance.errorsText(validate.errors)}`), {
      errors: validate.errors ?? undefined,
    })
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
