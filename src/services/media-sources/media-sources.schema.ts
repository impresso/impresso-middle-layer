import { ServiceSwaggerOptions } from 'feathers-swagger'
import { getStandardParameters, getStandardResponses, MethodParameter, QueryParameter } from '../../util/openapi'
import { MediaSource } from '../../models/generated/schemas'
import { OrderByValues } from './media-sources.class'

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

const findParameters: MethodParameter[] = [
  parameterTerm,
  parameterType,
  parameterOrderBy,
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
