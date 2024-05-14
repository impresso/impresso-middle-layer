import type { ServiceSwaggerOptions } from 'feathers-swagger'
import type { QueryParameter } from '../../util/openapi'
import { getRequestBodyContent, getStandardResponses } from '../../util/openapi'
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
      description: 'Find collections',
      parameters: findParameters,
      responses: getStandardResponses({
        method: 'find',
        schema: 'Collection',
      }),
    },
    get: {
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
