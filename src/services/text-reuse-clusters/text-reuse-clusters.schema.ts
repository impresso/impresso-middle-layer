import type { ServiceSwaggerOptions } from 'feathers-swagger'
import type { MethodParameter } from '../../util/openapi'
import { getStandardParameters, getStandardResponses } from '../../util/openapi'
import { OrderByKeyToField } from './text-reuse-clusters.class'
import { Filter } from '../../models'

export interface FindQueyParameters {
  text?: string
  skip?: number
  limit?: number
  orderBy?: string
  filters?: string | Filter[]
}

const findParameters: MethodParameter[] = [
  {
    in: 'query',
    name: 'text',
    required: false,
    schema: {
      type: 'string',
    },
    description: 'Search term',
  },
  {
    in: 'query',
    name: 'orderBy',
    required: false,
    schema: {
      type: 'string',
      enum: Object.keys(OrderByKeyToField)
        .map(key => [key, `-${key}`])
        .flat(),
    },
    description: 'Order by term',
  },
  {
    in: 'query',
    name: 'filters[]',
    required: false,
    schema: {
      type: 'array',
      items: require('../../schema/filter.json'),
    },
    description: 'Filters to apply',
  },
  ...getStandardParameters({ method: 'find', maxPageSize: 20 }),
]

const getParameters: MethodParameter[] = [
  {
    in: 'query',
    name: 'includeDetails',
    required: false,
    schema: {
      type: 'boolean',
    },
    description: 'Whether to include cluster details',
  },
  ...getStandardParameters({ method: 'get', idPattern: '[A-Za-z0-9-:@]+' }),
]

export const docs: ServiceSwaggerOptions = {
  description: 'Text Reuse Clusters',
  securities: ['find', 'get'],
  operations: {
    find: {
      description: 'Find text reuse clusters',
      parameters: findParameters,
      responses: getStandardResponses({
        method: 'find',
        schema: 'textReuseClustersFind',
      }),
    },
    get: {
      description: 'Get text reuse cluster by ID',
      parameters: getParameters,
      responses: getStandardResponses({
        method: 'get',
        schema: 'textReuseClustersGet',
      }),
    },
  },
}
