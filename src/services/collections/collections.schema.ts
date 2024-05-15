import type { ServiceSwaggerOptions } from 'feathers-swagger'
import type { QueryParameter } from '../../util/openapi'
import { getRequestBodyContent, getStandardParameters, getStandardResponses } from '../../util/openapi'
import { REGEX_UIDS } from '../../hooks/params'

const findParameters: QueryParameter[] = [
  {
    in: 'query',
    name: 'uids',
    required: false,
    schema: {
      type: 'string',
      pattern: String(REGEX_UIDS).slice(1, -1),
    },
    description: 'UIDs of collections (comma separated)',
  },
  {
    in: 'query',
    name: 'q',
    required: false,
    schema: {
      type: 'string',
      maxLength: 500,
    },
    description: 'Search term',
  },
  {
    in: 'query',
    name: 'order_by',
    required: true,
    schema: {
      type: 'string',
      default: '-date',
      enum: ['-date', 'date', '-size', 'size'],
    },
    description: 'Sort order',
  },
]

export const docs: ServiceSwaggerOptions = {
  description: 'Collections',
  securities: ['find', 'get', 'create', 'patch', 'remove'],
  operations: {
    find: {
      operationId: 'findCollections',
      description: 'Find collections',
      parameters: [...findParameters, ...getStandardParameters({ method: 'find' })],
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
}
