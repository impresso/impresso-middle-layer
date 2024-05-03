import type { ServiceSwaggerOptions } from 'feathers-swagger'
import { SolrMappings } from '../../data/constants'
import { QueryParameter, getSchemaRef, getStandardParameters, getStandardResponses } from '../../util/openapi'

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

export const OrderByChoices = ['-count', 'count']

const getGetParameters = (index: IndexId): QueryParameter[] => [
  {
    in: 'query',
    name: 'q',
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
      enum: OrderByChoices,
    },
    description: 'Order by',
  },
  {
    in: 'query',
    name: 'groupby',
    required: false,
    schema: {
      type: 'string',
      enum: facetTypes[index],
    },
    description: 'Group by',
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
    name: 'rangeStart',
    required: false,
    schema: {
      type: 'number',
    },
    description: 'Range start',
  },
  {
    in: 'query',
    name: 'rangeEnd',
    required: false,
    schema: {
      type: 'number',
    },
    description: 'Range end',
  },
  {
    in: 'query',
    name: 'rangeGap',
    required: false,
    schema: {
      type: 'number',
    },
    description: 'Range gap',
  },
  {
    in: 'query',
    name: 'rangeInclude',
    required: false,
    schema: {
      type: 'string',
      enum: ['edge', 'all', 'upper'],
    },
    description: 'Range include',
  },
]

const getFindParameters = (index: IndexId): QueryParameter[] => [
  {
    in: 'query',
    name: 'facets[]',
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

export const getDocs = (index: IndexId): ServiceSwaggerOptions => ({
  description: `${facetNames[index]} facets`,
  securities: ['get', 'find'],
  operations: {
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
        ...getGetParameters(index),
        ...getStandardParameters({ method: 'find' }),
      ],
      responses: getStandardResponses({
        method: 'get',
        schema: 'SearchFacet',
      }),
    },
  },
})
