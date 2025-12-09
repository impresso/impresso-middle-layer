import { ServiceSwaggerOptions } from 'feathers-swagger'
import { getStandardParameters, getStandardResponses, MethodParameter, QueryParameter } from '../../util/openapi'

const parameterTerm: QueryParameter = {
  in: 'query',
  name: 'term',
  required: false,
  schema: {
    type: 'string',
    maxLength: 100,
  },
  description: 'Search data providers with a specific term in their name or ID',
}

const findParameters: MethodParameter[] = [
  parameterTerm,
  ...getStandardParameters({ method: 'find', maxPageSize: 100 }),
]

const getParameters: MethodParameter[] = [...getStandardParameters({ method: 'get' })]

export const getDocs = (isPublicApi: boolean): ServiceSwaggerOptions => ({
  description: 'Data providers - partner institutions that provide content to Impresso',
  securities: ['find', 'get'],
  operations: {
    find: {
      operationId: 'findDataProviders',
      description: 'Find data providers',
      parameters: findParameters,
      responses: getStandardResponses({
        method: 'find',
        schema: 'DataProvider',
        isPublic: isPublicApi,
      }),
    },
    get: {
      operationId: 'getDataProvider',
      description: 'Get data provider by ID',
      parameters: getParameters,
      responses: getStandardResponses({
        method: 'get',
        schema: 'DataProvider',
        isPublic: isPublicApi,
      }),
    },
  },
})
