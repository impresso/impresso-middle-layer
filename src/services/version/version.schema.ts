import type { ServiceSwaggerOptions } from 'feathers-swagger'
import { getStandardResponses } from '../../util/openapi'

const versionResponseSchema = require('../../schema/version/response.json')

export const docs: ServiceSwaggerOptions = {
  description: 'Version of the API. Contains information about the current version of the API, features, etc.',
  securities: ['find'],
  operations: {
    find: {
      description: 'Get version object',
      parameters: [],
      security: [],
      responses: getStandardResponses({
        method: 'find',
        schema: 'versionFind',
        authEnabled: false,
        isRateLimited: false,
      }),
    },
  },
}
