import { ServiceSwaggerOptions } from 'feathers-swagger'
import type { MethodParameter } from '../../util/openapi'
import { getStandardParameters, getStandardResponses } from '../../util/openapi'

export const includeEmbeddingsParameter = {
  in: 'query',
  name: 'include_embeddings',
  required: false,
  schema: {
    type: 'boolean',
  },
  description: 'Whether to include embeddings in the response (default: `false`)',
} satisfies MethodParameter

export const includeTranscriptParameter = {
  in: 'query',
  name: 'include_transcript',
  required: false,
  schema: {
    type: 'boolean',
  },
  description: 'Whether to include transcript in the response (default: `false`)',
} satisfies MethodParameter

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
  includeEmbeddingsParameter,
  includeTranscriptParameter,
  ...getStandardParameters({ method: 'find' }),
]

const getParameters: MethodParameter[] = [includeEmbeddingsParameter]

/**
 * NOTE: Keep this in sync with validators in search.hooks.ts
 */
export const docs: ServiceSwaggerOptions = {
  description: 'Content items',
  securities: ['get'],
  operations: {
    // Duplicate of /search
    // find: {
    //   operationId: 'findContentItem',
    //   description: 'Find content items that match the given query',
    //   parameters: findParameters,
    //   responses: getStandardResponses({
    //     method: 'find',
    //     schema: 'ContentItem',
    //   }),
    // },
    get: {
      operationId: 'getContentItem',
      description: 'Get a content item by its UID',
      parameters: [
        {
          in: 'path',
          name: 'id',
          required: true,
          schema: {
            type: 'string',
          },
          description: 'UID of the content item',
        },
        ...getParameters,
      ],
      responses: getStandardResponses({
        method: 'get',
        schema: 'ContentItem',
      }),
    },
  },
}
