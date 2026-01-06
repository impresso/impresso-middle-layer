import type { ServiceSwaggerOptions } from 'feathers-swagger'
import type { MethodParameter } from '@/util/openapi.js'
import { filtersQueryParameter, getStandardParameters, getStandardResponses } from '@/util/openapi.js'
import { GroupByValues, OrderByKeyToField } from '@/services/text-reuse-passages/text-reuse-passages.class.js'

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

const parameterGroupBy: MethodParameter = {
  in: 'query',
  name: 'group_by',
  required: false,
  schema: {
    type: 'string',
    enum: GroupByValues,
  },
  description: 'Group by term',
}

const parameterAddOns: MethodParameter = {
  in: 'query',
  name: 'addons',
  required: false,
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      newspaper: {},
    },
  },
  description: 'Add-ons to apply',
}

const findParameters: MethodParameter[] = [
  parameterOrderBy,
  parameterGroupBy,
  filtersQueryParameter,
  parameterAddOns,
  ...getStandardParameters({ method: 'find', maxPageSize: 20 }),
]

const findParametersPublicApi: MethodParameter[] = [
  parameterOrderBy,
  filtersQueryParameter,
  ...getStandardParameters({ method: 'find', maxPageSize: 20 }),
]

export const getDocs = (isPublicApi: boolean): ServiceSwaggerOptions => ({
  description: 'Text Reuse Passages',
  securities: ['find', 'get'],
  operations: {
    find: {
      operationId: 'findTextReusePassages',
      description: 'Find text reuse passages',
      parameters: isPublicApi ? findParametersPublicApi : findParameters,
      responses: getStandardResponses({
        method: 'find',
        schema: 'TextReusePassage',
        isPublic: isPublicApi,
      }),
    },
    get: {
      operationId: 'getTextReusePassage',
      description: 'Get text reuse passage by ID',
      parameters: getStandardParameters({ method: 'get', idPattern: '[A-Za-z0-9-:@]+' }),
      responses: getStandardResponses({
        method: 'get',
        schema: 'TextReusePassage',
        isPublic: isPublicApi,
      }),
    },
  },
})
