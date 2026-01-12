import type { ServiceSwaggerOptions } from 'feathers-swagger'
import { getRequestBodyContent, getStandardResponses } from '@/util/openapi.js'

export const imageEmbedderDocs: ServiceSwaggerOptions = {
  tags: ['Tools'],
  description: 'Embed images into a vector space',
  securities: ['create'],
  operations: {
    create: {
      operationId: 'performImageEmbedding',
      description: 'Embed an image into a vector space',
      requestBody: {
        content: getRequestBodyContent('ImpressoImageEmbeddingRequest'),
      },
      responses: getStandardResponses({
        method: 'create',
        schema: 'ImpressoEmbeddingResponse',
        standardPagination: false,
      }),
    },
  },
}

export const textEmbedderDocs: ServiceSwaggerOptions = {
  tags: ['Tools'],
  description: 'Embed texts into a vector space',
  securities: ['create'],
  operations: {
    create: {
      operationId: 'performTextEmbedding',
      description: 'Embed a text into a vector space',
      requestBody: {
        content: getRequestBodyContent('ImpressoTextEmbeddingRequest'),
      },
      responses: getStandardResponses({
        method: 'create',
        schema: 'ImpressoEmbeddingResponse',
        standardPagination: false,
      }),
    },
  },
}
