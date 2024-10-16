import type { ServiceSwaggerOptions } from 'feathers-swagger'
import type { MethodParameter } from '../../util/openapi'
import { filtersQueryParameter, getStandardParameters, getStandardResponses } from '../../util/openapi'
import { GroupByValues, OrderByKeyToField } from './text-reuse-passages.class'

const findParameters: MethodParameter[] = [
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
    name: 'group_by',
    required: false,
    schema: {
      type: 'string',
      enum: GroupByValues,
    },
    description: 'Group by term',
  },
  filtersQueryParameter,
  {
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
  },
  ...getStandardParameters({ method: 'find', maxPageSize: 20 }),
]

export const docs: ServiceSwaggerOptions = {
  description: 'Text Reuse Passages',
  securities: ['find', 'get'],
  operations: {
    find: {
      operationId: 'findTextReusePassages',
      description: 'Find text reuse passages',
      parameters: findParameters,
      responses: getStandardResponses({
        method: 'find',
        schema: 'TextReusePassage',
      }),
    },
    get: {
      operationId: 'getTextReusePassage',
      description: 'Get text reuse passage by ID',
      parameters: getStandardParameters({ method: 'get', idPattern: '[A-Za-z0-9-:@]+' }),
      responses: getStandardResponses({
        method: 'get',
        schema: 'TextReusePassage',
      }),
    },
  },
}
