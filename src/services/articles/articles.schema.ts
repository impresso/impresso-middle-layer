import { ServiceSwaggerOptions } from 'feathers-swagger'
import { REGEX_UID } from '../../hooks/params'
import type { MethodParameter } from '../../util/openapi'
import { getStandardParameters, getStandardResponses } from '../../util/openapi'

const findParameters: MethodParameter[] = [
  {
    in: 'query',
    name: 'resolve',
    required: false,
    schema: {
      type: 'string',
      enum: ['collection', 'tags'],
    },
    description: 'TODO',
  },
  {
    in: 'query',
    name: 'order_by',
    required: false,
    schema: {
      type: 'string',
      enum: ['-date', 'date', '-relevance', 'relevance'],
    },
    description: 'Order by term',
  },
  {
    in: 'query',
    name: 'filters',
    required: false,
    schema: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['type'],
        properties: {
          type: {
            type: 'string',
            enum: ['uid', 'issue', 'page', 'newspaper', 'hasTextContents'],
          },
          q: {
            type: 'string',
            pattern: String(REGEX_UID).slice(1, -1),
          },
        },
      },
    },
    description: 'Filters to apply',
  },
  ...getStandardParameters({ method: 'find' }),
]

/**
 * NOTE: Keep this in sync with validators in search.hooks.ts
 */
export const docs: ServiceSwaggerOptions = {
  description: 'Articles',
  securities: ['find', 'get'],
  operations: {
    find: {
      operationId: 'findArticles',
      description: 'Find articles that match the given query',
      parameters: findParameters,
      responses: getStandardResponses({
        method: 'find',
        schema: 'Article',
      }),
    },
    get: {
      operationId: 'getArticle',
      description: 'Get an article by its UID',
      parameters: [
        {
          in: 'path',
          name: 'id',
          required: true,
          schema: {
            type: 'string',
          },
          description: 'UID of the article',
        },
      ],
      responses: getStandardResponses({
        method: 'get',
        schema: 'Article',
      }),
    },
  },
}
