import type { ServiceSwaggerOptions } from 'feathers-swagger'
import { getRequestBodyContent, getStandardResponses } from '../../util/openapi'

export const docs: ServiceSwaggerOptions = {
  description: 'Impresso Named Entity Recognition',
  securities: ['create'],
  operations: {
    create: {
      operationId: 'performNer',
      description: 'Perform Named Entity Recognition of a text',
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
