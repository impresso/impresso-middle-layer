import type { ServiceSwaggerOptions } from 'feathers-swagger'

const versionResponseSchema = require('../../schema/version/response.json')

export const docs: ServiceSwaggerOptions = {
  description: 'Version of the API. Contains information about the current version of the API, features, etc.',
  securities: ['find'],
  schemas: { versionResponseSchema },
  refs: { findResponse: 'versionResponseSchema' },
  operations: {
    find: {
      description: 'Get version object',
      parameters: [],
      security: [],
    },
  },
}
