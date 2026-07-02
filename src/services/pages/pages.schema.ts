import { ServiceSwaggerOptions } from 'feathers-swagger'
import { getStandardParameters, getStandardResponses, MethodParameter, QueryParameter } from '@/util/openapi.js'

export const PageFilterFields = ['id', 'issueId', 'num', 'hasCoords', 'hasErrors', 'iiif'] as const
export const BinaryFilterInputValues = ['0', '1', 'true', 'false'] as const

const parameterId: QueryParameter = {
  in: 'query',
  name: 'id',
  required: false,
  schema: {
    type: 'array',
    items: {
      type: 'string',
      minLength: 1,
    },
  },
  description: 'Filter pages by one or more page IDs',
}

const parameterIssueId: QueryParameter = {
  in: 'query',
  name: 'issueId',
  required: false,
  schema: {
    type: 'array',
    items: {
      type: 'string',
      minLength: 1,
    },
  },
  description: 'Filter pages by one or more issue IDs',
}

const parameterNum: QueryParameter = {
  in: 'query',
  name: 'num',
  required: false,
  schema: {
    type: 'array',
    items: {
      type: 'integer',
      minimum: 0,
    },
  },
  description: 'Filter pages by one or more page numbers',
}

const parameterHasCoords: QueryParameter = {
  in: 'query',
  name: 'hasCoords',
  required: false,
  schema: {
    type: 'array',
    items: {
      type: 'string',
      enum: [...BinaryFilterInputValues],
    },
  },
  description: 'Filter pages by converted coordinates flag (0, 1, true, false)',
}

const parameterHasErrors: QueryParameter = {
  in: 'query',
  name: 'hasErrors',
  required: false,
  schema: {
    type: 'array',
    items: {
      type: 'string',
      enum: [...BinaryFilterInputValues],
    },
  },
  description: 'Filter pages by corrupted JSON flag (0, 1, true, false)',
}

const parameterMediaSourceId: QueryParameter = {
  in: 'query',
  name: 'mediaSourceId',
  required: false,
  schema: {
    type: 'array',
    items: {
      type: 'string',
      minLength: 1,
    },
  },
  description: 'Filter pages whose issue belongs to one or more media sources (matched as issue_id prefix)',
}

const parameterIiif: QueryParameter = {
  in: 'query',
  name: 'iiif',
  required: false,
  schema: {
    type: 'array',
    items: {
      type: 'string',
      maxLength: 200,
    },
  },
  description: 'Filter pages by one or more IIIF manifest URLs',
}

const findParameters: MethodParameter[] = [
  parameterId,
  parameterIssueId,
  parameterNum,
  parameterHasCoords,
  parameterHasErrors,
  parameterIiif,
  parameterMediaSourceId,
  ...getStandardParameters({ method: 'find' }),
]

const getParameters: MethodParameter[] = [...getStandardParameters({ method: 'get' })]

export const getDocs = (isPublicApi: boolean): ServiceSwaggerOptions => ({
  description: 'Pages',
  securities: ['find', 'get'],
  operations: {
    find: {
      operationId: 'findPages',
      description: 'Find pages with optional list-based filters',
      parameters: findParameters,
      responses: getStandardResponses({
        method: 'find',
        schema: 'Page',
        isPublic: isPublicApi,
      }),
    },
    get: {
      operationId: 'getPage',
      description: 'Get page by ID',
      parameters: getParameters,
      responses: getStandardResponses({
        method: 'get',
        schema: 'Page',
        isPublic: isPublicApi,
      }),
    },
  },
})
