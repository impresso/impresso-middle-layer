import type { ServiceSwaggerOptions } from 'feathers-swagger'
import { getRequestBodyContent, getStandardResponses } from '../../util/openapi'

export const docs: ServiceSwaggerOptions = {
  description: 'Various tools',
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
