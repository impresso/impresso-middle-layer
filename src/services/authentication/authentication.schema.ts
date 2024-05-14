import { ServiceSwaggerOptions } from 'feathers-swagger'
import { getRequestBodyContent, getResponseContent, getSchemaRef } from '../../util/openapi'

export const docs: ServiceSwaggerOptions = {
  description: 'Issue a token for the user',
  securities: ['create'],
  operations: {
    create: {
      description: 'Authenticate user',
      requestBody: {
        content: getRequestBodyContent('AuthenticationCreateRequest'),
      },
      responses: {
        201: {
          description: 'Authentication successful',
          content: getResponseContent('AuthenticationCreateResponse'),
        },
      },
    },
  },
}
