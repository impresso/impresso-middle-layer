import type { Application, HookContext } from '@feathersjs/feathers'
import {
  FormatName,
  JSONSchemaDefinition,
  addFormats,
  getValidator,
  Ajv,
  hooks as schemaHooks,
} from '@feathersjs/schema'
import type { JSONSchema7 as JSONSchema } from 'json-schema'

interface Parameter {
  name: string
  required: boolean
  schema: JSONSchema
  description: string
}

export interface QueryParameter extends Parameter {
  in: 'query'
}

export interface PathParameter extends Parameter {
  in: 'path'
}

export type MethodParameter = QueryParameter | PathParameter

interface StatusResponse {
  description: string
  content?: string | object
}

export const jsonSchemaRef = (ref: string) => {
  return {
    'application/json': {
      schema: {
        $ref: `#/components/schemas/${ref}`,
      },
    },
  }
}

const defaultErrorSchema = jsonSchemaRef('defaultErrorResponse')

interface GetStandardResponsesParams {
  method: 'create' | 'update' | 'patch' | 'remove' | 'find' | 'get'
  schema: string | JSONSchema
  authEnabled?: boolean
  isRateLimited?: boolean
}

export const getStandardResponses = ({
  method,
  schema,
  authEnabled = true,
  isRateLimited = false,
}: GetStandardResponsesParams) => {
  const defaultResponses: Record<number, StatusResponse> = {
    422: {
      description: 'Unprocessable Entity',
      content: defaultErrorSchema,
    },
    500: {
      description: 'general error',
    },
  }
  if (method === 'create') {
    defaultResponses[201] = {
      description: 'Created',
      content: typeof schema === 'string' ? jsonSchemaRef(schema) : schema,
    }
  } else {
    defaultResponses[200] = {
      description: 'Success',
      content: typeof schema === 'string' ? jsonSchemaRef(schema) : schema,
    }
    defaultResponses[404] = {
      description: 'Not Found',
      content: defaultErrorSchema,
    }
  }

  if (authEnabled) {
    defaultResponses[401] = {
      description: 'Not Authenticated',
      content: defaultErrorSchema,
    }
    defaultResponses[403] = {
      description: 'Unauthorized',
      content: defaultErrorSchema,
    }
  }

  if (isRateLimited) {
    defaultResponses[429] = {
      description: 'Rate limit exceeded',
      content: defaultErrorSchema,
    }
  }

  return defaultResponses
}

interface GetStandardParametersOptions {
  method: 'find' | 'get' | 'remove' | 'update'
  maxPageSize?: number
  idPattern?: string
}

export const getStandardParameters = ({
  method,
  maxPageSize,
  idPattern,
}: GetStandardParametersOptions): MethodParameter[] => {
  if (method === 'find') {
    return [
      {
        in: 'query',
        name: 'limit',
        required: false,
        schema: {
          type: 'integer',
          minimum: 1,
          maximum: maxPageSize ?? 1000,
        },
        description: 'Total items to return',
      },
      {
        in: 'query',
        name: 'skip',
        required: false,
        schema: {
          type: 'integer',
          minimum: 0,
        },
        description: 'Items to skip',
      },
    ]
  }

  if (method === 'get') {
    return [
      {
        in: 'path',
        name: 'id',
        required: true,
        schema: {
          type: 'string',
          minLength: 1,
          pattern: idPattern,
        },
        description: 'ID of the item',
      },
    ]
  }

  return []
}

const DefaultFindSchema = require('../schema/common/findResponse')

interface GetFindResponseOptions {
  itemRef: string
  title?: string
}

export const getFindResponse = ({ itemRef, title }: GetFindResponseOptions): JSONSchema => {
  const schema: JSONSchema = JSON.parse(JSON.stringify(DefaultFindSchema))
  const data: any = schema!.properties!.data
  data.items.$ref = `#/components/schemas/${itemRef}`
  schema!.properties!.data = data

  if (title != null) {
    schema.title = `Find ${title} Response`
  }
  return schema
}

const isQueryParameter = (parameter: MethodParameter): parameter is QueryParameter => {
  return parameter.in === 'query'
}

const isPathParameter = (parameter: MethodParameter): parameter is PathParameter => {
  return parameter.in === 'path'
}

const formats: FormatName[] = [
  'date-time',
  'time',
  'date',
  'email',
  'hostname',
  'ipv4',
  'ipv6',
  'uri',
  'uri-reference',
  'uuid',
  'uri-template',
  'json-pointer',
  'relative-json-pointer',
  'regex',
]

export const dataValidator = addFormats(new Ajv({}), formats)

export const queryValidator = addFormats(
  new Ajv({
    coerceTypes: true,
  }),
  formats
)

export const validateParameters = (parameters: MethodParameter[]) => {
  const querySchemaProperties = parameters.filter(isQueryParameter).reduce<Record<string, JSONSchema>>(
    (acc, parameter) => {
      acc[parameter.name] = parameter.schema
      return acc
    },
    {} as Record<string, JSONSchema>
  )
  const querySchema: JSONSchema = {
    properties: querySchemaProperties,
  }

  const validateQuery = getValidator(querySchema as JSONSchemaDefinition, queryValidator)

  const pathSchemaProperties = parameters.filter(isPathParameter).reduce<Record<string, JSONSchema>>(
    (acc, parameter) => {
      acc[parameter.name] = parameter.schema
      return acc
    },
    {} as Record<string, JSONSchema>
  )
  const pathSchema: JSONSchema = {
    properties: pathSchemaProperties,
  }
  const validatePath = getValidator(pathSchema as JSONSchemaDefinition, queryValidator)

  return async (context: HookContext<Application>) => {
    const [query, path] = await Promise.all([validateQuery(context.params.query), validatePath(context)])
    context.params.query = query
    context.params.path = path
  }
}
