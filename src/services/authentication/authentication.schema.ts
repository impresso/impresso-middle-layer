import { ServiceSwaggerOptions } from 'feathers-swagger'
import {
  defaultHeaders,
  getDefaultErrorResponseContent,
  getRequestBodyContent,
  getResponseContent,
  retryAfterHeaders,
} from '@/util/openapi.js'

export const docs: ServiceSwaggerOptions = {
  description: 'Issue a token for the user',
  securities: ['create'],
  operations: {
    create: {
      operationId: 'authenticationIssueToken',
      description: 'Authenticate user',
      requestBody: {
        content: getRequestBodyContent('AuthenticationCreateRequest'),
      },
      security: [],
      responses: {
        201: {
          description: 'Authentication successful',
          content: getResponseContent('AuthenticationCreateResponse'),
          headers: { ...defaultHeaders },
        },
        400: {
          description: 'Invalid request',
          content: getDefaultErrorResponseContent(),
          headers: { ...defaultHeaders },
        },
        429: {
          description: 'Invalid request',
          content: getDefaultErrorResponseContent(),
          headers: { ...defaultHeaders, ...retryAfterHeaders },
        },
      },
    },
  },
}
