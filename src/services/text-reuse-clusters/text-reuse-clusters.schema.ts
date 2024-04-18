import type { ServiceSwaggerOptions } from 'feathers-swagger'
import type { MethodParameter } from '../../util/openapi'
import { getFindResponse, getStandardParameters, getStandardResponses } from '../../util/openapi'
import { OrderByKeyToField } from './text-reuse-clusters.class'

const cluster = require('../../schema/models/text-reuse/cluster.json')
cluster.$id = 'cluster'
const clusterDetails = require('../../schema/models/text-reuse/clusterDetails.json')
cluster.$id = 'clusterDetails'

const clusterGetResponse = require('./schema/get/response.json')
clusterGetResponse.$id = 'clusterGetResponse'
clusterGetResponse.properties.cluster.$ref = '#/components/schemas/cluster'
clusterGetResponse.properties.details.$ref = '#/components/schemas/clusterDetails'

const clusterFindResponse = require('./schema/find/response.json')
clusterFindResponse.$id = 'clusterFindResponse'
clusterFindResponse.properties.clusters.items.$ref = '#/components/schemas/clusterGetResponse'
clusterFindResponse.properties.info.$ref = '#/components/schemas/pagination'

const findParameters: MethodParameter[] = [
  {
    in: 'query',
    name: 'orderBy',
    required: false,
    schema: {
      type: 'string',
      enum: Object.keys(OrderByKeyToField)
        .map(key => [key, `-${key}`])
        .flat(),
    },
    description: 'Order by term',
  },
  {
    in: 'query',
    name: 'filters[]',
    required: false,
    schema: {
      type: 'array',
      items: require('../../schema/filter.json'),
    },
    description: 'Filters to apply',
  },
  ...getStandardParameters({ method: 'find', maxPageSize: 20 }),
]

const getParameters: MethodParameter[] = [
  {
    in: 'query',
    name: 'includeDetails',
    required: false,
    schema: {
      type: 'boolean',
    },
    description: 'Whether to include cluster details',
  },
  ...getStandardParameters({ method: 'get', idPattern: '[A-Za-z0-9-:@]+' }),
]

export const docs: ServiceSwaggerOptions = {
  description: 'Text Reuse Clusters',
  securities: ['find', 'get'],
  schemas: {
    cluster,
    clusterDetails,
    clusterGetResponse,
    clustersFindResponse: getFindResponse({ itemRef: 'cluster', title: cluster.title }),
  },
  operations: {
    find: {
      description: 'Find text reuse clusters',
      parameters: findParameters,
      responses: getStandardResponses({
        method: 'find',
        schema: 'clustersFindResponse',
      }),
    },
    get: {
      description: 'Get text reuse cluster by ID',
      parameters: getParameters,
      responses: getStandardResponses({
        method: 'get',
        schema: 'clusterGetResponse',
      }),
    },
  },
}
