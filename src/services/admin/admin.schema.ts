import { ServiceSwaggerOptions } from 'feathers-swagger'
import { getStandardResponses } from '../../util/openapi'

export const getDocs = (): ServiceSwaggerOptions => ({
  description: 'Admin information',
  securities: ['find'],
  operations: {
    find: {
      operationId: 'admin',
      description: 'Get admin information',
      parameters: [],
      responses: getStandardResponses({
        method: 'find',
        schema: 'Freeform',
        isPublic: true,
        standardPagination: false,
      }),
    },
  },
})
