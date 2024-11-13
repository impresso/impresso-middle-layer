import type { ServiceSwaggerOptions } from 'feathers-swagger'
import type { MethodParameter, QueryParameter } from '../../util/openapi'
import { getRequestBodyContent, getStandardParameters, getStandardResponses } from '../../util/openapi'
import { REGEX_UIDS } from '../../hooks/params'

const parameterUids: QueryParameter = {
  in: 'query',
  name: 'uids',
  required: false,
  schema: {
    type: 'string',
    pattern: String(REGEX_UIDS).slice(1, -1),
  },
  description: 'UIDs of collections (comma separated)',
}

const parameterTerm: QueryParameter = {
  in: 'query',
  name: 'term',
  required: false,
  schema: {
    type: 'string',
    maxLength: 500,
  },
  description: 'Search term',
}

const parameterQ: QueryParameter = {
  in: 'query',
  name: 'q',
  required: false,
  schema: {
    type: 'string',
    maxLength: 500,
  },
  description: 'Search term',
}

const parameterOrderBy: QueryParameter = {
  in: 'query',
  name: 'order_by',
  required: true,
  schema: {
    type: 'string',
    default: '-date',
    enum: ['-date', 'date', '-size', 'size'],
  },
  description: 'Sort order',
}

const findParameters: MethodParameter[] = [
  parameterUids,
  parameterQ,
  parameterOrderBy,
  ...getStandardParameters({ method: 'find' }),
]

const findParametersPublicApi: MethodParameter[] = [
  parameterTerm,
  parameterOrderBy,
  ...getStandardParameters({ method: 'find' }),
]

export const getDocs = (isPublicApi: boolean): ServiceSwaggerOptions => ({
  description: 'Collections',
  securities: ['find', 'get', 'create', 'patch', 'remove'],
  operations: {
    find: {
      operationId: 'findCollections',
      description: 'Find collections',
      parameters: isPublicApi ? findParametersPublicApi : findParameters,
      responses: getStandardResponses({
        method: 'find',
        schema: 'Collection',
      }),
    },
    get: {
      operationId: 'getCollection',
      description: 'Get a collection by its UID',
      parameters: [
        {
          in: 'path',
          name: 'id',
          required: true,
          schema: {
            type: 'string',
          },
          description: 'UID of the collection',
        },
      ],
      responses: getStandardResponses({
        method: 'get',
        schema: 'Collection',
      }),
    },
    create: {
      operationId: 'createCollection',
      description: 'Create a new collection',
      requestBody: {
        content: getRequestBodyContent('NewCollection'),
      },
      responses: getStandardResponses({
        method: 'create',
        schema: 'Collection',
      }),
    },
    patch: {
      operationId: 'updateCollection',
      description: 'Update a collection',
      parameters: [
        {
          in: 'path',
          name: 'id',
          required: true,
          schema: {
            type: 'string',
          },
          description: 'UID of the collection',
        },
      ],
      requestBody: {
        content: getRequestBodyContent('NewCollection'),
      },
      responses: getStandardResponses({
        method: 'patch',
        schema: 'Collection',
      }),
    },
    remove: {
      operationId: 'removeCollection',
      description: 'Remove a collection',
      parameters: [
        {
          in: 'path',
          name: 'id',
          required: true,
          schema: {
            type: 'string',
          },
          description: 'UID of the collection',
        },
      ],
      responses: getStandardResponses({
        method: 'remove',
        schema: 'CollectionsRemoveResponse',
      }),
    },
  },
})
