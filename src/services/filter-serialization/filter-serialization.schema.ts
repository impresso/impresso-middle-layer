import type { ServiceSwaggerOptions } from 'feathers-swagger'
import { getRequestBodyContent, getStandardResponses } from '@/util/openapi.js'

export const docs: ServiceSwaggerOptions = {
  tags: ['Tools'],
  description: 'Serialize filters into the protobuf base64 representation used by query parameters.',
  securities: ['create'],
  operations: {
    create: {
      operationId: 'serializeFilters',
      description: 'Serialize a list of filters into a protobuf base64 string.',
      security: [],
      requestBody: {
        content: getRequestBodyContent('FilterSerializationRequest'),
      },
      responses: getStandardResponses({
        method: 'create',
        schema: 'FilterSerializationResponse',
        standardPagination: false,
        authEnabled: false,
      }),
    },
  },
}
