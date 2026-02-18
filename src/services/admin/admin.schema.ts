import { ServiceSwaggerOptions } from 'feathers-swagger'
import { getRequestBodyContent, getStandardResponses } from '@/util/openapi.js'

export const getDocs = (): ServiceSwaggerOptions => ({
  description: 'Admin information',
  multi: ['patch'],
  securities: ['find', 'patchMulti'],
  operations: {
    find: {
      operationId: 'admin',
      description: 'Get admin information',
      parameters: [],
      responses: getStandardResponses({
        method: 'find',
        schema: 'admin',
        isPublic: true,
        standardPagination: false,
      }),
    },
    patchMulti: {
      operationId: 'adminPatch',
      description: 'Admin maintenance operations',
      parameters: [],
      requestBody: {
        content: getRequestBodyContent('AdminPatchRequest'),
      },
      responses: getStandardResponses({
        method: 'patch',
        schema: 'Freeform',
        isPublic: true,
        standardPagination: false,
      }),
    },
  },
})
