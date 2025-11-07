import type { ServiceSwaggerOptions } from 'feathers-swagger'
import { MethodParameter, QueryParameter, filtersQueryParameter } from '../../util/openapi'
import { getStandardParameters, getStandardResponses } from '../../util/openapi'

const parameterQ: QueryParameter = {
  in: 'query',
  name: 'q',
  required: false,
  schema: {
    type: 'string',
    minLength: 1,
    maxLength: 50,
  },
  description: 'Search term for topic suggestions',
}

const parameterOrderBy: QueryParameter = {
  in: 'query',
  name: 'order_by',
  required: false,
  schema: {
    type: 'string',
    default: 'name',
    enum: ['name', '-name', 'model', '-model'],
  },
  description: 'Sort order',
}

const findParameters: MethodParameter[] = [
  parameterQ,
  parameterOrderBy,
  filtersQueryParameter,
  ...getStandardParameters({ method: 'find' }),
]

export const getDocs = (isPublicApi: boolean): ServiceSwaggerOptions => ({
  description: 'Topics',
  securities: ['find', 'get'],
  operations: {
    find: {
      operationId: 'findTopics',
      description: 'Find topics',
      parameters: findParameters,
      responses: getStandardResponses({
        method: 'find',
        schema: 'Topic',
        isPublic: isPublicApi,
      }),
    },
    get: {
      operationId: 'getTopic',
      description: 'Get a topic by its UID',
      parameters: [
        {
          in: 'path',
          name: 'id',
          required: true,
          schema: {
            type: 'string',
          },
          description: 'UID of the topic',
        },
      ],
      responses: getStandardResponses({
        method: 'get',
        schema: 'Topic',
        isPublic: isPublicApi,
      }),
    },
  },
})
