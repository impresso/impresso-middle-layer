import { ServiceSwaggerOptions } from 'feathers-swagger'
import { SolrMappings } from '@/data/constants.js'
import type { MethodParameter } from '@/util/openapi.js'
import { filtersQueryParameter, getStandardParameters, getStandardResponses } from '@/util/openapi.js'
import { paramsValidator } from '@/services/search/search.validators.js'
import { includeEmbeddingsParameter } from '@/services/content-items/content-items.schema.js'

const parameterQ: MethodParameter = {
  in: 'query',
  name: 'q',
  required: paramsValidator.q.required,
  schema: {
    type: 'string',
    minLength: 2,
    maxLength: 1000,
  },
  description: 'Search query term.',
}

const parameterTerm: MethodParameter = {
  in: 'query',
  name: 'term',
  required: paramsValidator.q.required,
  schema: {
    type: 'string',
    minLength: 2,
    maxLength: 1000,
  },
  description: 'Search query term.',
}
const parameterGroupBy: MethodParameter = {
  in: 'query',
  name: 'group_by',
  required: paramsValidator.group_by.required,
  schema: {
    type: 'string',
    enum: paramsValidator.group_by.choices,
    default: paramsValidator.group_by.choices[0],
  },
  description: 'Group by term',
}
const parameterOrderBy: MethodParameter = {
  in: 'query',
  name: 'order_by',
  required: false,
  schema: {
    type: 'string',
    enum: paramsValidator.order_by.choices,
  },
  description: 'Order by term',
}
const parameterFacets: MethodParameter = {
  in: 'query',
  name: 'facets',
  required: false,
  schema: {
    type: 'string',
    enum: Object.keys(SolrMappings.search.facets),
  },
  description: 'Facet to return',
}

const findParameters: MethodParameter[] = [
  parameterQ,
  parameterGroupBy,
  parameterOrderBy,
  parameterFacets,
  filtersQueryParameter,
  ...getStandardParameters({ method: 'find' }),
]

const findParametersPublicApi: MethodParameter[] = [
  parameterTerm,
  parameterOrderBy,
  filtersQueryParameter,
  includeEmbeddingsParameter,
  ...getStandardParameters({ method: 'find' }),
]

/**
 * NOTE: Keep this in sync with validators in search.hooks.ts
 */
export const getDocs = (isPublicApi: boolean): ServiceSwaggerOptions => ({
  description: 'Search content items',
  securities: ['find'],
  operations: {
    find: {
      operationId: 'search',
      description: 'Find content items that match the given query',
      parameters: isPublicApi ? findParametersPublicApi : findParameters,
      responses: getStandardResponses({
        method: 'find',
        schema: 'ContentItem',
        isPublic: isPublicApi,
      }),
    },
  },
})
