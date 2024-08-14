import { ServiceSwaggerOptions } from 'feathers-swagger'
import { MethodParameter, getRequestBodyContent, getStandardParameters, getStandardResponses } from '../../util/openapi'
import { REGEX_UID } from '../../hooks/params'

const patchParameters: MethodParameter[] = [
  {
    in: 'path',
    name: 'id',
    required: true,
    schema: {
      type: 'string',
      pattern: String(REGEX_UID).slice(1, -1),
    },
    description: 'Collection ID',
  },
]

/**
 * NOTE: Keep this in sync with validators in search.hooks.ts
 */
export const docs: ServiceSwaggerOptions = {
  description: 'Collectable items',
  multi: ['patch'],
  securities: ['patchMulti'],
  operations: {
    patch: {
      // hide this endpoint from the public API - it's not used
      // but required for feathersjs
      tags: ['ignored'],
    },
    patchMulti: {
      description: 'Update items in the collection',
      parameters: patchParameters,
      requestBody: {
        content: getRequestBodyContent('UpdateCollectableItems'),
      },
      responses: getStandardResponses({
        method: 'patchMulti',
        schema: 'CollectableItemsUpdatedResponse',
      }),
    },
  },
}
