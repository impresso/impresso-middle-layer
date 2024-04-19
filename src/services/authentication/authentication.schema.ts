import { ServiceSwaggerOptions } from 'feathers-swagger'

const authRequestSchema = require('../../schema/authentication/request.json')

const authResponseSchema = require('../../schema/authentication/response.json')
authResponseSchema.properties.user.$ref = '#/components/schemas/user'

const userSchema = require('../../schema/authentication/user.json')
userSchema.$id = 'user'

const defaultErrorResponseSchema = require('../../schema/common/defaultErrorResponse.json')
defaultErrorResponseSchema.$id = '#/components/schemas/defaultErrorResponse'

export { authRequestSchema, authResponseSchema, userSchema }

export const docs: ServiceSwaggerOptions = {
  description: 'Issue a token for the user',
  securities: ['create'],
  schemas: {
    user: userSchema,
    authRequestSchema,
    authResponseSchema,
    defaultErrorResponse: defaultErrorResponseSchema,
  },
  refs: {
    createRequest: 'authRequestSchema',
    createResponse: 'authResponseSchema',
  },
  operations: {
    create: {
      description: 'Authenticate user',
    },
  },
}
