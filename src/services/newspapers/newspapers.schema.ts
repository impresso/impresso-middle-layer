import { ServiceSwaggerOptions } from 'feathers-swagger'
import type { MethodParameter, QueryParameter } from '../../util/openapi'
import { getStandardParameters, getStandardResponses } from '../../util/openapi'

export const OrderByChoices = [
  '-name',
  'name',
  '-startYear',
  'startYear',
  '-endYear',
  'endYear',
  'firstIssue',
  '-firstIssue',
  'lastIssue',
  '-lastIssue',
  'countIssues',
  '-countIssues',
]

const parameterIncludedOnly: QueryParameter = {
  in: 'query',
  name: 'includedOnly',
  required: false,
  schema: {
    type: 'boolean',
  },
  description: 'Return included newspapers only (TODO)',
}

const parameterOrderBy: QueryParameter = {
  in: 'query',
  name: 'order_by',
  required: false,
  schema: {
    type: 'string',
    enum: OrderByChoices,
  },
  description: 'Order by term',
}

const parameterFaster: QueryParameter = {
  in: 'query',
  name: 'faster',
  required: false,
  schema: {
    type: 'boolean',
  },
  description: 'For quick lookup only, disable sorting and looking for stats',
}

const parameterQ: QueryParameter = {
  in: 'query',
  name: 'q',
  required: false,
  schema: {
    type: 'string',
    maxLength: 500,
  },
  description: 'Search by this term in newspaper title',
}

const parameterTerm: QueryParameter = {
  in: 'query',
  name: 'term',
  required: false,
  schema: {
    type: 'string',
    maxLength: 500,
  },
  description: 'Search by this term in newspaper title',
}

const findParameters: MethodParameter[] = [
  parameterIncludedOnly,
  parameterOrderBy,
  parameterFaster,
  parameterQ,
  ...getStandardParameters({ method: 'find' }),
]

const findParametersPublic: MethodParameter[] = [
  parameterTerm,
  parameterOrderBy,
  ...getStandardParameters({ method: 'find' }),
]

export const getDocs = (isPublicApi: boolean): ServiceSwaggerOptions => ({
  description: 'Newspapers',
  securities: ['find', 'get'],
  operations: {
    find: {
      operationId: 'findNewspapers',
      description: 'Find newspapers that match the given query',
      parameters: isPublicApi ? findParametersPublic : findParameters,
      responses: getStandardResponses({
        method: 'find',
        schema: 'Newspaper',
        isPublic: isPublicApi,
      }),
    },
    get: {
      operationId: 'getNewspaper',
      description: 'Get a newspaper by ID',
      parameters: [
        {
          in: 'path',
          name: 'id',
          required: true,
          schema: {
            type: 'string',
          },
          description: 'UID of the newspaper',
        },
      ],
      responses: getStandardResponses({
        method: 'get',
        schema: 'Newspaper',
        isPublic: isPublicApi,
      }),
    },
  },
})
