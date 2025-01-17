import { ServiceSwaggerOptions } from 'feathers-swagger'
import { getStandardParameters, getStandardResponses, MethodParameter, QueryParameter } from '../../util/openapi'

const parameterTerm: QueryParameter = {
  in: 'query',
  name: 'term',
  required: false,
  schema: {
    type: 'string',
    maxLength: 100,
  },
  description: 'Search images with a specific term in their caption',
}

const similarToImageId: QueryParameter = {
  in: 'query',
  name: 'similar_to_image_id',
  required: false,
  schema: {
    type: 'string',
    maxLength: 128,
  },
  description: 'Find images similar to the image with the given ID',
}

const findParameters: MethodParameter[] = [
  // parameterTerm,
  similarToImageId,
  ...getStandardParameters({ method: 'find', maxPageSize: 100 }),
]
const getParameters: MethodParameter[] = [...getStandardParameters({ method: 'get' })]

export const getDocs = (isPublicApi: boolean): ServiceSwaggerOptions => ({
  description: 'Images',
  securities: ['find', 'get'],
  operations: {
    find: {
      operationId: 'findImages',
      description: 'Find images',
      parameters: findParameters,
      responses: getStandardResponses({
        method: 'find',
        schema: 'Image',
        isPublic: isPublicApi,
      }),
    },
    get: {
      operationId: 'getImage',
      description: 'Get image by ID',
      parameters: getParameters,
      responses: getStandardResponses({
        method: 'get',
        schema: 'Image',
        isPublic: isPublicApi,
      }),
    },
  },
})
