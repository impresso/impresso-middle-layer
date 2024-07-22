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
  headers?: object
}

const asApplicationJson = (schema: JSONSchema) => ({
  'application/json': {
    schema,
  },
})

const asApplicationProblemJson = (schema: JSONSchema) => ({
  'application/problem+json': {
    schema,
  },
})

export const getSchemaRef = (schemaName: string) => ({
  $ref: `#/components/schemas/${schemaName}`,
})

export const getResponseRef = (schemaName: string) => ({
  $ref: `#/components/schemas/${schemaName}`,
})

export const getParameterRef = (schemaName: string) => ({
  $ref: `#/components/parameters/${schemaName}`,
})

const defaultErrorSchema = getSchemaRef('Error')

interface GetStandardResponsesParams {
  method: 'create' | 'update' | 'patch' | 'remove' | 'find' | 'get'
  schema: string
  authEnabled?: boolean
  isRateLimited?: boolean
  standardPagination?: boolean
}

const baseFindResponse = require('../schema/schemas/BaseFind.json')
delete baseFindResponse['$schema']

const getBaseFindResponse = (itemRef: string): JSONSchema => {
  const response = JSON.parse(JSON.stringify(baseFindResponse))
  response['properties']['data']['items'] = {
    $ref: itemRef,
  }
  return response
}

export const defaultHeaders = {
  RateLimit: {
    schema: {
      type: 'string',
    },
  },
}

export const retryAfterHeaders = { 'Retry-After': { schema: { type: 'string' } } }

export const getStandardResponses = ({
  method,
  schema,
  authEnabled = true,
  isRateLimited = true,
  standardPagination = true,
}: GetStandardResponsesParams) => {
  const defaultResponses: Record<number, StatusResponse> = {
    422: {
      description: 'Unprocessable Entity',
      content: asApplicationProblemJson(defaultErrorSchema),
      headers: { ...defaultHeaders },
    },
    500: {
      description: 'general error',
      content: asApplicationProblemJson(defaultErrorSchema),
      headers: { ...defaultHeaders },
    },
  }
  if (method === 'create') {
    defaultResponses[201] = {
      description: 'Created',
      content: asApplicationJson(getResponseRef(schema)),
      headers: { ...defaultHeaders },
    }
  } else {
    if (method === 'find' && standardPagination) {
      defaultResponses[200] = {
        description: 'Success',
        content: asApplicationJson(getBaseFindResponse(`#/components/schemas/${schema}`)),
        headers: { ...defaultHeaders },
      }
    } else {
      defaultResponses[200] = {
        description: 'Success',
        content: asApplicationJson(getResponseRef(schema)),
        headers: { ...defaultHeaders },
      }
    }
    defaultResponses[404] = {
      description: 'Not Found',
      content: asApplicationProblemJson(defaultErrorSchema),
      headers: { ...defaultHeaders },
    }
  }

  if (authEnabled) {
    defaultResponses[401] = {
      description: 'Not Authenticated',
      content: asApplicationProblemJson(defaultErrorSchema),
      headers: { ...defaultHeaders },
    }
    defaultResponses[403] = {
      description: 'Unauthorized',
      content: asApplicationProblemJson(defaultErrorSchema),
      headers: { ...defaultHeaders },
    }
  }

  if (isRateLimited) {
    defaultResponses[429] = {
      description: 'Rate limit exceeded',
      content: asApplicationProblemJson(defaultErrorSchema),
      headers: { ...defaultHeaders, ...retryAfterHeaders },
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
        description: 'Total items to return.',
      },
      {
        in: 'query',
        name: 'offset',
        required: false,
        schema: {
          type: 'integer',
          minimum: 0,
        },
        description: 'Starting index of items set to return',
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

export const getRequestBodyContent = (schemaName: string) => {
  return {
    'application/json': {
      schema: {
        $ref: `#/components/schemas/${schemaName}`,
      },
    },
  }
}

export const getResponseContent = (schemaName: string) => {
  return {
    'application/json': {
      schema: {
        $ref: `#/components/schemas/${schemaName}`,
      },
    },
  }
}

export const getDefaultErrorResponseContent = () => {
  return asApplicationProblemJson(defaultErrorSchema)
}

export const filtersQueryParameter: QueryParameter = {
  in: 'query',
  name: 'filters',
  required: false,
  schema: { oneOf: [{ type: 'string' }, { type: 'array', items: getSchemaRef('Filter') }] },
  description: 'Create filters using Impresso <a href="https://example.com" target="_blank">filter builder</a>.',
}
