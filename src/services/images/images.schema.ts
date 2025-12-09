import { ServiceSwaggerOptions } from 'feathers-swagger'
import {
  filtersQueryParameter,
  getStandardParameters,
  getStandardResponses,
  MethodParameter,
  QueryParameter,
} from '../../util/openapi'
import { OrderByChoices } from './images.class'

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

const parameterOrderBy: QueryParameter = {
  in: 'query',
  name: 'order_by',
  required: false,
  schema: {
    type: 'string',
    enum: OrderByChoices,
  },
  description: 'Order by',
}

const parameterIncludeEmbeddings: QueryParameter = {
  in: 'query',
  name: 'include_embeddings',
  required: false,
  schema: {
    type: 'boolean',
  },
  description: 'Whether to include embeddings in the response (default: `false`)',
}

const findParameters: MethodParameter[] = [
  parameterTerm,
  similarToImageId,
  parameterOrderBy,
  filtersQueryParameter,
  parameterIncludeEmbeddings,
  ...getStandardParameters({ method: 'find', maxPageSize: 100 }),
]
const getParameters: MethodParameter[] = [...getStandardParameters({ method: 'get' }), parameterIncludeEmbeddings]

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
