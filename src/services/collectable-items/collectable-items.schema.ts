import { ServiceSwaggerOptions } from 'feathers-swagger'
import { MethodParameter, getRequestBodyContent, getStandardParameters, getStandardResponses } from '../../util/openapi'
import { REGEX_UID } from '../../hooks/params'

const patchParameters: MethodParameter[] = [
  {
    in: 'path',
    name: 'collection_id',
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
      // NOTE: If requestBody and responses are not provided,
      // the `RefParser.bundle` will fail with an error
      // "MissingPointerError: Token ":id" does not exist."
      requestBody: {
        content: getRequestBodyContent('UpdateCollectableItemsRequest'),
      },
      responses: getStandardResponses({
        method: 'patchMulti',
        schema: 'CollectableItemsUpdatedResponse',
      }),

      tags: ['not-used'],
    },
    patchMulti: {
      description: 'Update items in the collection',
      parameters: patchParameters,
      requestBody: {
        content: getRequestBodyContent('UpdateCollectableItemsRequest'),
      },
      responses: getStandardResponses({
        method: 'patchMulti',
        schema: 'CollectableItemsUpdatedResponse',
      }),
    },
  },
}
