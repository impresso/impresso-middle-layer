import type { ServiceSwaggerOptions } from 'feathers-swagger'
import type { QueryParameter } from '../../types'
import { getStandardResponses } from '../../util/openapi'
import { GroupByValues, OrderByKeyToField } from './text-reuse-passages.class'
import { SolrFields } from '../../models/text-reuse-passages.model'

const filterSchema = require('../../schema/search/filter.json')
const addonsSchema = require('../../schema/services/text-reuse-passages/addons.json')

const passageSchema = require('../../schema/services/text-reuse-passages/passage.json')
passageSchema.$id = 'passage'

const findPassagesSchema = require('../../schema/services/text-reuse-passages/findResponse.json')
findPassagesSchema.$id = 'findPassagesResponse'
findPassagesSchema.properties.data.items.$ref = '#/components/schemas/passage'

const findParameters: QueryParameter[] = [
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
    name: 'groupby',
    required: false,
    schema: {
      type: 'string',
      enum: GroupByValues,
    },
    description: 'Group by term',
  },
  {
    in: 'query',
    name: 'filters',
    required: false,
    schema: {
      type: 'array',
      items: filterSchema,
    },
    description: 'Filters to apply',
  },
  {
    in: 'query',
    name: 'addons',
    required: false,
    schema: {
      type: 'array',
      items: addonsSchema,
    },
    description: 'Add-ons to apply',
  },
  {
    in: 'query',
    name: 'limit',
    required: false,
    schema: {
      type: 'integer',
      minimum: 1,
      maximum: 1000,
    },
    description: 'Total items to return',
  },
  {
    in: 'query',
    name: 'skip',
    required: false,
    schema: {
      type: 'integer',
      minimum: 0,
    },
    description: 'Items to skip',
  },
]

export const docs: ServiceSwaggerOptions = {
  description: 'Text Reuse Passages',
  securities: ['find', 'get'],
  schemas: { passage: passageSchema, findPassagesResponse: findPassagesSchema },
  operations: {
    find: {
      description: 'Find text reuse passages',
      parameters: findParameters,
      responses: getStandardResponses({
        method: 'find',
        schema: 'findPassagesResponse',
      }),
    },
    get: {
      description: 'Get text reuse passage by ID',
      parameters: [
        {
          in: 'path',
          name: 'id',
          required: true,
          schema: {
            type: 'string',
            minLength: 1,
          },
          description: 'ID of the passage',
        },
      ],
      responses: getStandardResponses({
        method: 'get',
        schema: 'passage',
      }),
    },
  },
}
