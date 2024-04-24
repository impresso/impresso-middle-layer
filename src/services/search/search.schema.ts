import { ServiceSwaggerOptions } from 'feathers-swagger'
import { SolrMappings } from '../../data/constants'
import type { QueryParameter } from '../../util/openapi'
import { getSchemaRef, getStandardResponses } from '../../util/openapi'
import { paramsValidator } from './search.validators'

const findParameters: QueryParameter[] = [
  {
    in: 'query',
    name: 'q',
    required: paramsValidator.q.required,
    schema: {
      type: 'string',
      minLength: 2,
      maxLength: 1000,
    },
    description: 'Search query term',
  },
  {
    in: 'query',
    name: 'group_by',
    required: paramsValidator.group_by.required,
    schema: {
      type: 'string',
      enum: paramsValidator.group_by.choices,
      default: paramsValidator.group_by.choices[0],
    },
    description: 'Group by term',
  },
  {
    in: 'query',
    name: 'order_by',
    required: false,
    schema: {
      type: 'string',
      enum: paramsValidator.order_by.choices,
    },
    description: 'Order by term',
  },
  {
    in: 'query',
    name: 'facets',
    required: false,
    schema: {
      type: 'string',
      enum: Object.keys(SolrMappings.search.facets),
    },
    description: 'Facet to return',
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

/**
 * NOTE: Keep this in sync with validators in search.hooks.ts
 */
export const docs: ServiceSwaggerOptions = {
  description: 'Search articles',
  securities: ['find'],
  operations: {
    find: {
      description: 'Find articles that match the given query',
      parameters: findParameters,
      responses: getStandardResponses({
        method: 'find',
        schema: 'searchFind',
      }),
    },
  },
}
