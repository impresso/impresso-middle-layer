import type { ServiceSwaggerOptions } from 'feathers-swagger'
import { defaultHeaders, getDefaultErrorResponseContent } from '@/util/openapi.js'

const getCsvResponses = () => {
  return {
    200: {
      description: 'Success',
      content: {
        'text/csv': {
          schema: {
            type: 'string',
          },
        },
      },
      headers: { ...defaultHeaders },
    },
    500: {
      description: 'general error',
      content: getDefaultErrorResponseContent(),
      headers: { ...defaultHeaders },
    },
  }
}

const getDocs = ({ operationId, description }: { operationId: string; description: string }): ServiceSwaggerOptions => {
  return {
    description,
    operations: {
      find: {
        operationId,
        description,
        parameters: [],
        security: [],
        responses: getCsvResponses(),
      },
    },
  }
}

export const getDataProvidersCsvDocs = (): ServiceSwaggerOptions => {
  return getDocs({
    operationId: 'getDataProvidersCsvExport',
    description: 'Get data providers metadata as a CSV',
  })
}

export const getDataSourcesCsvDocs = (): ServiceSwaggerOptions => {
  return getDocs({
    operationId: 'getDataSourcesCsvExport',
    description: 'Get data sources metadata as a CSV',
  })
}

export const getContentItemTypesCsvDocs = (): ServiceSwaggerOptions => {
  return getDocs({
    operationId: 'getContentItemTypesCsvExport',
    description: 'Get content item types metadata as a CSV',
  })
}
