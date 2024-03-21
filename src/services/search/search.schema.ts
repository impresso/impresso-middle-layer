import { querySyntax } from '@feathersjs/schema'
import { paramsValidator } from './search.validators';
import { SolrMappings } from '../../data/constants';
import { ServiceSwaggerOptions } from 'feathers-swagger';

const filterSchema = require('../../schema/search/filter.json')

export const searchQuerySchema = {
  $id: 'SearchQuery',
  type: 'object',
  additionalProperties: false,
  properties: {
    ...querySyntax({
      filters: {
        type: 'array',
        items: filterSchema
      }
    })
  }
} as const

/**
 * NOTE: Keep this in sync with validators in search.hooks.ts
 */
export const docs: ServiceSwaggerOptions = {
  description: 'Search articles',
  securities: ['find'],
  operations: {
    find: {
      description: 'Find articles that match the given query',
      parameters: [
        {
          in: 'query',
          name: 'q',
          required: paramsValidator.q.required,
          schema: {
            type: 'string'
          },
          description: 'Search query term'
        },
        {
          in: 'query',
          name: 'group_by',
          required: paramsValidator.group_by.required,
          schema: {
            type: 'string',
            enum: paramsValidator.group_by.choices,
          },
          description: 'Group by term'
        },
        {
          in: 'query',
          name: 'order_by',
          required: false,
          schema: {
            type: 'string',
            enum: paramsValidator.order_by.choices,
          },
          description: 'Order by term'
        },
        {
          in: 'query',
          name: 'facets',
          required: false,
          schema: {
            type: 'string',
            enum: Object.keys(SolrMappings.search.facets),
          },
          description: 'Facet to return'
        },
        {
          in: 'query',
          name: 'filters',
          required: false,
          schema: {
            type: 'array',
            items: filterSchema,
          },
          description: 'Filters to apply'
        }
      ]
    }
  }
}