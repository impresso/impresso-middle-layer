import type { ServiceSwaggerOptions } from 'feathers-swagger'
import { SolrMappings } from '../../data/constants'
import {
  MethodParameter,
  QueryParameter,
  filtersQueryParameter,
  getStandardParameters,
  getStandardResponses,
} from '../../util/openapi'

const SupportedIndexes = Object.keys(SolrMappings)

export type IndexId = 'search' | 'tr-clusters' | 'tr-passages'

export const facetTypes: Record<IndexId, string[]> = {
  search: Object.keys(SolrMappings.search.facets),
  'tr-clusters': Object.keys(SolrMappings['tr_clusters'].facets),
  'tr-passages': Object.keys(SolrMappings['tr_passages'].facets),
}

const facetNames: Record<IndexId, string> = {
  search: 'search index',
  'tr-clusters': 'text reuse clusters index',
  'tr-passages': 'text reuse passages index',
}

export const OrderByChoices = ['-count', 'count', '-value', 'value']

const parameterOrderBy: QueryParameter = {
  in: 'query',
  name: 'order_by',
  required: false,
  schema: {
    type: 'string',
    enum: OrderByChoices,
  },
  description: 'Order by',
}

const parameterGroupBy = (index: IndexId): QueryParameter => ({
  in: 'query',
  name: 'group_by',
  required: false,
  schema: {
    type: 'string',
    enum: facetTypes[index],
  },
  description: 'Group by',
})

const parameterRangeStart: QueryParameter = {
  in: 'query',
  name: 'range_start',
  required: false,
  schema: {
    type: 'number',
  },
  description: 'Range start',
}

const parameterRangeEnd: QueryParameter = {
  in: 'query',
  name: 'range_end',
  required: false,
  schema: {
    type: 'number',
  },
  description: 'Range end',
}

const parameterRangeGap: QueryParameter = {
  in: 'query',
  name: 'range_gap',
  required: false,
  schema: {
    type: 'number',
  },
  description: 'Range gap',
}

const parameterRangeInclude: QueryParameter = {
  in: 'query',
  name: 'range_include',
  required: false,
  schema: {
    type: 'string',
    enum: ['edge', 'all', 'upper'],
  },
  description: 'Range include',
}

const getGetParameters = (index: IndexId): MethodParameter[] => [
  parameterOrderBy,
  parameterGroupBy(index),
  filtersQueryParameter,
  parameterRangeStart,
  parameterRangeEnd,
  parameterRangeGap,
  parameterRangeInclude,
  ...getStandardParameters({ method: 'find' }),
]

const getGetParametersPublic = (index: IndexId): MethodParameter[] => [
  parameterOrderBy,
  filtersQueryParameter,
  ...getStandardParameters({ method: 'find' }),
]

const getFindParameters = (index: IndexId): QueryParameter[] => [
  {
    in: 'query',
    name: 'facets',
    required: true,
    schema: {
      type: 'array',
      items: {
        type: 'string',
        enum: facetTypes[index],
      },
    },
    description: 'Facets to return',
  },
]

const toPascalCase = (s: string) => {
  const result = s.replace(/([-_][a-z])/gi, $1 => $1.toUpperCase().replace('-', '').replace('_', ''))
  return result.charAt(0).toUpperCase() + result.slice(1)
}

export const getDocs = (index: IndexId, isPublicApi: boolean): ServiceSwaggerOptions => ({
  description: `${facetNames[index]} facets`,
  securities: ['get' /*, 'find' */],
  operations: {
    // RK: I disabled the find operation because it can be entirely replaced by individual get operations,
    // not used in impresso-py and adds extra maintenance burden.
    /*
    find: {
      operationId: `find${toPascalCase(index)}Facets`,
      description: `Get mutliple ${facetNames[index]} facets`,
      parameters: [
        ...getFindParameters(index),
        ...getGetParameters(index),
        ...getStandardParameters({ method: 'find' }),
      ],
      responses: getStandardResponses({
        method: 'find',
        schema: 'SearchFacet',
      }),
    },
    */
    get: {
      operationId: `get${toPascalCase(index)}Facet`,
      description: `Get a single ${facetNames[index]} facet`,
      parameters: [
        {
          in: 'path',
          name: 'id',
          required: true,
          schema: {
            type: 'string',
            enum: facetTypes[index],
          },
          description: 'Type of the facet',
        },
        ...(isPublicApi ? getGetParametersPublic(index) : getGetParameters(index)),
      ],
      responses: getStandardResponses({
        method: 'find',
        schema: 'SearchFacetBucket',
        isPublic: isPublicApi,
      }),
    },
  },
})
