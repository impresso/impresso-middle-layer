import type { ServiceSwaggerOptions } from 'feathers-swagger'
import type { QueryParameter } from '../../util/openapi'
import { getStandardResponses, jsonSchemaRef } from '../../util/openapi'
import { REGEX_UIDS } from '../../hooks/params'

const baseUserSchema = require('../../schema/models/base-user.model.json')
baseUserSchema.$id = 'baseUser'

const collectionSchema = require('../../schema/models/collection.model.json')
collectionSchema.$id = 'collection'
collectionSchema.properties.creator.$ref = '#/components/schemas/baseUser'

const collectionFindResponseSchema = require('../../schema/collections/findResponse.json')
collectionFindResponseSchema.$id = 'collectionFindResponse'
collectionFindResponseSchema.properties.data.items.$ref = '#/components/schemas/collection'

const newCollectionSchema = require('../../schema/collections/newCollection.json')
newCollectionSchema.$id = 'newCollection'

const collectionRemoveResponseSchema = require('../../schema/collections/removeResponse.json')
collectionRemoveResponseSchema.$id = 'collectionRemoveResponse'

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
  schemas: {
    baseUser: baseUserSchema,
    collection: collectionSchema,
    collectionFindResponseSchema,
    newCollection: newCollectionSchema,
    collectionRemoveResponseSchema,
  },
  operations: {
    find: {
      description: 'Find collections',
      parameters: findParameters,
      responses: getStandardResponses({
        method: 'find',
        schema: 'collectionFindResponseSchema',
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
        schema: 'collection',
      }),
    },
    create: {
      description: 'Create a new collection',
      requestBody: {
        content: jsonSchemaRef('newCollection'),
      },
      responses: getStandardResponses({
        method: 'create',
        schema: 'collection',
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
        content: jsonSchemaRef('newCollection'),
      },
      responses: getStandardResponses({
        method: 'patch',
        schema: 'collection',
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
        schema: 'collectionRemoveResponseSchema',
      }),
    },
  },
}
