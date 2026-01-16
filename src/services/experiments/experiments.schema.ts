import { ServiceSwaggerOptions } from 'feathers-swagger'
import { getStandardResponses, MethodParameter } from '@/util/openapi.js'

const updateParameters: MethodParameter[] = [
  {
    in: 'path',
    name: 'id',
    required: true,
    schema: {
      type: 'string',
    },
    description: 'The experiment ID to work with',
  },
]

export const getDocs = (isPublicApi: boolean): ServiceSwaggerOptions => ({
  description: 'Experiments',
  securities: ['find', 'update'],
  operations: {
    find: {
      operationId: 'findExperiments',
      description: 'Get a list of available experiments',
      parameters: [],
      responses: getStandardResponses({
        method: 'find',
        schema: 'ExperimentInfo',
        isPublic: isPublicApi,
      }),
    },
    update: {
      operationId: 'interactWithExperiment',
      description: 'Interact with an experiment with experiment specific data',
      parameters: updateParameters,
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              additionalProperties: true,
              description: 'Experiment specific request body',
            },
          },
        },
      },
      responses: getStandardResponses({
        method: 'update',
        schema: 'Freeform',
        isPublic: isPublicApi,
      }),
    },
  },
})
