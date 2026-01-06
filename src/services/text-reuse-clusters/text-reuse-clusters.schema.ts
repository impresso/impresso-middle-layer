import type { ServiceSwaggerOptions } from 'feathers-swagger'
import type { MethodParameter } from '@/util/openapi.js'
import { filtersQueryParameter, getStandardParameters, getStandardResponses } from '@/util/openapi.js'
import { OrderByKeyToField } from '@/services/text-reuse-clusters/text-reuse-clusters.class.js'
import { Filter } from '@/models/index.js'

export interface FindQueyParameters {
  text?: string
  offset?: number
  limit?: number
  order_by?: string
  filters?: string | Filter[]
}

const parameterText: MethodParameter = {
  in: 'query',
  name: 'text',
  required: false,
  schema: {
    type: 'string',
  },
  description: 'Search term',
}

const parameterTerm: MethodParameter = {
  in: 'query',
  name: 'term',
  required: false,
  schema: {
    type: 'string',
  },
  description: 'Search term',
}

const parameterOrderBy: MethodParameter = {
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
}

const findParameters: MethodParameter[] = [
  parameterText,
  parameterOrderBy,
  filtersQueryParameter,
  ...getStandardParameters({ method: 'find', maxPageSize: 20 }),
]

const findParametersPublicApi: MethodParameter[] = [
  parameterTerm,
  parameterOrderBy,
  filtersQueryParameter,
  ...getStandardParameters({ method: 'find', maxPageSize: 20 }),
]

const parameterIncludeDetails: MethodParameter = {
  in: 'query',
  name: 'include_details',
  required: false,
  schema: {
    type: 'boolean',
  },
  description: 'Whether to include cluster details',
}

const getParameters: MethodParameter[] = [
  parameterIncludeDetails,
  ...getStandardParameters({ method: 'get', idPattern: '[A-Za-z0-9-:@]+' }),
]

const getParametersPublicApi: MethodParameter[] = [
  ...getStandardParameters({ method: 'get', idPattern: '[A-Za-z0-9-:@]+' }),
]

export const getDocs = (isPublicApi: boolean): ServiceSwaggerOptions => ({
  description: 'Text Reuse Clusters',
  securities: ['find', 'get'],
  operations: {
    find: {
      operationId: 'findTextReuseClusters',
      description: 'Find text reuse clusters',
      parameters: isPublicApi ? findParametersPublicApi : findParameters,
      responses: getStandardResponses({
        method: 'find',
        schema: 'TextReuseCluster',
        isPublic: isPublicApi,
      }),
    },
    get: {
      operationId: 'getTextReuseCluster',
      description: 'Get text reuse cluster by ID',
      parameters: isPublicApi ? getParametersPublicApi : getParameters,
      responses: getStandardResponses({
        method: 'get',
        schema: 'TextReuseCluster',
        isPublic: isPublicApi,
      }),
    },
  },
})
