import type { ServiceSwaggerOptions } from 'feathers-swagger'
import type { MethodParameter } from '../../util/openapi'
import { getSchemaRef, getStandardParameters, getStandardResponses } from '../../util/openapi'
import { OrderByKeyToField } from './text-reuse-clusters.class'
import { Filter } from '../../models'

export interface FindQueyParameters {
  text?: string
  offset?: number
  limit?: number
  order_by?: string
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
    name: 'order_by',
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
    name: 'filters',
    required: false,
    schema: {
      type: 'array',
      items: getSchemaRef('Filter'),
    },
    description: 'Filters to apply',
  },
  ...getStandardParameters({ method: 'find', maxPageSize: 20 }),
]

const getParameters: MethodParameter[] = [
  {
    in: 'query',
    name: 'include_details',
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
      operationId: 'findTextReuseClusters',
      description: 'Find text reuse clusters',
      parameters: findParameters,
      responses: getStandardResponses({
        method: 'find',
        schema: 'FindTextReuseClustersResponse',
        standardPagination: false,
      }),
    },
    get: {
      operationId: 'getTextReuseCluster',
      description: 'Get text reuse cluster by ID',
      parameters: getParameters,
      responses: getStandardResponses({
        method: 'get',
        schema: 'TextReuseClusterCompound',
      }),
    },
  },
}
