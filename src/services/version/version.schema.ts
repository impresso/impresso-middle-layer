import type { ServiceSwaggerOptions } from 'feathers-swagger'
import { getStandardResponses } from '@/util/openapi.js'

export const docs: ServiceSwaggerOptions = {
  description: 'Version of the API. Contains information about the current version of the API, features, etc.',
  securities: ['find'],
  operations: {
    find: {
      operationId: 'getVersionDetails',
      description: 'Get version object',
      parameters: [],
      security: [],
      responses: getStandardResponses({
        method: 'find',
        schema: 'VersionDetails',
        standardPagination: false,
        authEnabled: false,
        isRateLimited: false,
      }),
    },
  },
}
