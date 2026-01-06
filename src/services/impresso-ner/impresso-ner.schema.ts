import type { ServiceSwaggerOptions } from 'feathers-swagger'
import { getRequestBodyContent, getStandardResponses } from '@/util/openapi.js'

export const docs: ServiceSwaggerOptions = {
  tags: ['Tools'],
  description: 'Name entity recognition and linking',
  securities: ['create'],
  operations: {
    create: {
      operationId: 'performNer',
      description: 'Perform named entity recognition (and optional named entity linking) of a text',
      requestBody: {
        content: getRequestBodyContent('ImpressoNerRequest'),
      },
      responses: getStandardResponses({
        method: 'create',
        schema: 'ImpressoNerResponse',
        standardPagination: false,
      }),
    },
  },
}
