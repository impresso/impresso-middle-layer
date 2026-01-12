import { ServiceSwaggerOptions } from 'feathers-swagger'
import { getStandardParameters, getStandardResponses, QueryParameter } from '@/util/openapi.js'
import { DefaultPageSize, DefaultTopK, ValidLanguageCodes } from './embeddings.class.js'

const parameterTerm: QueryParameter = {
  in: 'query',
  name: 'term',
  required: true,
  schema: {
    type: 'string',
    maxLength: 100,
    minLength: 2,
  },
  description: 'The term to find similar words for',
}

const parameterLanguage: QueryParameter = {
  in: 'query',
  name: 'language_code',
  required: false,
  schema: {
    type: 'string',
    enum: ['de', 'fr', 'lb'] satisfies ValidLanguageCodes[],
    maxLength: 2,
  },
  description: 'Filter baseline embedding search results (term search) by language code',
}

const parameterTopK: QueryParameter = {
  in: 'query',
  name: 'top_k',
  required: false,
  schema: {
    type: 'integer',
    minimum: 1,
    maximum: 100,
    default: DefaultTopK,
  },
  description: 'Top-K parameter for calculating similarity',
}

const findParameters = [
  parameterTerm,
  parameterLanguage,
  parameterTopK,
  ...getStandardParameters({ method: 'find', maxPageSize: DefaultPageSize }),
]

export const getDocs = (isPublicApi: boolean): ServiceSwaggerOptions => ({
  description: 'Word embeddings service for finding similar words',
  securities: ['find'],
  operations: {
    find: {
      operationId: 'findSimilarWords',
      description: 'Find words similar to the given term based on their embeddings',
      parameters: findParameters,
      responses: getStandardResponses({
        method: 'find',
        schema: 'WordMatch',
        isPublic: isPublicApi,
      }),
    },
  },
})
