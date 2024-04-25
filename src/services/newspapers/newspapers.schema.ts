import { ServiceSwaggerOptions } from 'feathers-swagger'
import { SolrMappings } from '../../data/constants'
import type { QueryParameter } from '../../util/openapi'
import { getSchemaRef, getStandardParameters, getStandardResponses } from '../../util/openapi'

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

const findParameters: QueryParameter[] = [
  {
    in: 'query',
    name: 'filters',
    required: false,
    schema: {
      type: 'array',
      items: getSchemaRef('Filter'),
    },
    description: 'Filters to apply',
  },
  {
    in: 'query',
    name: 'order_by',
    required: false,
    schema: {
      type: 'string',
      enum: OrderByChoices,
    },
    description: 'Order by term',
  },
  {
    in: 'query',
    name: 'faster',
    required: false,
    schema: {
      type: 'boolean',
    },
    description: 'For quick lookup only, disable sorting and looking for stats',
  },
  {
    in: 'query',
    name: 'q',
    required: false,
    schema: {
      type: 'string',
      maxLength: 500,
    },
    description: 'Search by this term in newspaper title',
  },
]

export const docs: ServiceSwaggerOptions = {
  description: 'Newspapers',
  securities: ['find', 'get'],
  operations: {
    find: {
      description: 'Find newspapers that match the given query',
      parameters: [...findParameters, ...getStandardParameters({ method: 'find' })],
      responses: getStandardResponses({
        method: 'find',
        schema: 'newspapersFind',
      }),
    },
    get: {
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
        schema: 'newspapersGet',
      }),
    },
  },
}
