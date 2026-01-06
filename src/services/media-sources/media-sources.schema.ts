import { ServiceSwaggerOptions } from 'feathers-swagger'
import { getStandardParameters, getStandardResponses, MethodParameter, QueryParameter } from '@/util/openapi.js'
import { MediaSource } from '@/models/generated/schemas.js'
import { OrderByValues } from '@/services/media-sources/media-sources.class.js'

const parameterTerm: QueryParameter = {
  in: 'query',
  name: 'term',
  required: false,
  schema: {
    type: 'string',
    maxLength: 100,
  },
  description: 'Search sources with a specific term in their name',
}

const parameterType: QueryParameter = {
  in: 'query',
  name: 'type',
  required: false,
  schema: {
    type: 'string',
    enum: ['newspaper'] satisfies MediaSource['type'][],
    maxLength: 100,
  },
  description: 'Filter sources by type',
}

const parameterOrderBy: QueryParameter = {
  in: 'query',
  name: 'order_by',
  required: false,
  schema: {
    type: 'string',
    enum: [...OrderByValues],
    maxLength: 100,
  },
  description: 'Order sources by a specific field',
}

const parameterIncludeProperties: QueryParameter = {
  in: 'query',
  name: 'include_properties',
  required: false,
  schema: {
    type: 'boolean',
    default: false,
  },
  description: 'Include properties in the response',
}

const findParameters: MethodParameter[] = [
  parameterTerm,
  parameterType,
  parameterOrderBy,
  parameterIncludeProperties,
  ...getStandardParameters({ method: 'find', maxPageSize: 100 }),
]
const getParameters: MethodParameter[] = [...getStandardParameters({ method: 'get' })]

export const getDocs = (isPublicApi: boolean): ServiceSwaggerOptions => ({
  description: 'Media sources',
  securities: ['find', 'get'],
  operations: {
    find: {
      operationId: 'findMediaSources',
      description: 'Find media sources',
      parameters: findParameters,
      responses: getStandardResponses({
        method: 'find',
        schema: 'MediaSource',
        isPublic: isPublicApi,
      }),
    },
    get: {
      operationId: 'getMediaSource',
      description: 'Get media source by ID',
      parameters: getParameters,
      responses: getStandardResponses({
        method: 'get',
        schema: 'MediaSource',
        isPublic: isPublicApi,
      }),
    },
  },
})
