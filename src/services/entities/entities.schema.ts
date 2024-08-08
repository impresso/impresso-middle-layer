import type { ServiceSwaggerOptions } from 'feathers-swagger'
import type { QueryParameter } from '../../util/openapi'
import { filtersQueryParameter, getStandardParameters, getStandardResponses } from '../../util/openapi'
import { orderByValues } from './entities.hooks'

const findParameters: QueryParameter[] = [
  {
    in: 'query',
    name: 'q',
    required: false,
    schema: {
      type: 'string',
      minLength: 2,
      maxLength: 1000,
    },
    description: 'Search query term',
  },
  {
    in: 'query',
    name: 'resolve',
    required: false,
    schema: {
      type: 'boolean',
    },
    description: 'Resolve wikidata entity details (slow). Default `false`.',
  },
  {
    in: 'query',
    name: 'order_by',
    required: false,
    schema: {
      type: 'string',
      enum: orderByValues,
    },
    description: 'Order by term',
  },
  filtersQueryParameter,
]

export const docs: ServiceSwaggerOptions = {
  description: 'Entities',
  securities: ['find', 'get'],
  operations: {
    find: {
      operationId: 'findEntities',
      description: 'Find entities that match the given query',
      parameters: [...findParameters, ...getStandardParameters({ method: 'find' })],
      responses: getStandardResponses({
        method: 'find',
        schema: 'EntityDetails',
      }),
    },
    get: {
      operationId: 'getEntity',
      description: 'Get an entity by ID',
      parameters: [
        {
          in: 'path',
          name: 'id',
          required: true,
          schema: {
            type: 'string',
          },
          description: 'UID of the entity',
        },
      ],
      responses: getStandardResponses({
        method: 'get',
        schema: 'EntityDetails',
      }),
    },
  },
}
