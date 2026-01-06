import type { ServiceSwaggerOptions } from 'feathers-swagger'
import type { MethodParameter, QueryParameter } from '@/util/openapi.js'
import { filtersQueryParameter, getStandardParameters, getStandardResponses } from '@/util/openapi.js'
import { orderByValues } from '@/services/entities/entities.hooks.js'

const parameterQ: QueryParameter = {
  in: 'query',
  name: 'q',
  required: false,
  schema: {
    type: 'string',
    minLength: 2,
    maxLength: 1000,
  },
  description: 'Search query term',
}

const parameterTerm: QueryParameter = {
  in: 'query',
  name: 'term',
  required: false,
  schema: {
    type: 'string',
    minLength: 2,
    maxLength: 1000,
  },
  description: 'Search query term',
}

const parameterResolve: QueryParameter = {
  in: 'query',
  name: 'resolve',
  required: false,
  schema: {
    type: 'boolean',
    default: false,
  },
  description: 'Resolve wikidata entity details (slow). Default `false`.',
}

const parameterOrderBy: QueryParameter = {
  in: 'query',
  name: 'order_by',
  required: false,
  schema: {
    type: 'string',
    enum: orderByValues,
  },
  description: 'Order by term',
}

const findParameters: MethodParameter[] = [
  parameterQ,
  parameterResolve,
  parameterOrderBy,
  filtersQueryParameter,
  ...getStandardParameters({ method: 'find' }),
]

const findParametersPublic: MethodParameter[] = [
  parameterTerm,
  parameterResolve,
  parameterOrderBy,
  filtersQueryParameter,
  ...getStandardParameters({ method: 'find' }),
]

export const getDocs = (isPublicApi: boolean): ServiceSwaggerOptions => ({
  description: 'Entities',
  securities: ['find', 'get'],
  operations: {
    find: {
      operationId: 'findEntities',
      description: 'Find entities that match the given query',
      parameters: isPublicApi ? findParametersPublic : findParameters,
      responses: getStandardResponses({
        method: 'find',
        schema: 'EntityDetails',
        isPublic: isPublicApi,
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
        isPublic: isPublicApi,
      }),
    },
  },
})
