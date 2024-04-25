import { ServiceSwaggerOptions } from 'feathers-swagger'
import { QueryParameter, getStandardResponses } from '../../util/openapi'
import { REGEX_UIDS } from '../../hooks/params'

const findParameters: QueryParameter[] = [
  {
    in: 'query',
    name: 'collection_uids',
    required: false,
    schema: {
      type: 'string',
      pattern: String(REGEX_UIDS).slice(1, -1),
    },
    description: 'TODO',
  },
  {
    in: 'query',
    name: 'item_uids',
    required: false,
    schema: {
      type: 'string',
      pattern: String(REGEX_UIDS).slice(1, -1),
    },
    description: 'TODO',
  },
  {
    in: 'query',
    name: 'resolve',
    required: true,
    schema: {
      type: 'string',
      enum: ['collection', 'item'],
      default: 'collection',
    },
    description: 'TODO',
  },
  {
    in: 'query',
    name: 'order_by',
    required: false,
    schema: {
      type: 'string',
      enum: ['-dateAdded', 'dateAdded', '-itemDate', 'itemDate'],
      default: '-dateAdded',
    },
    description: 'Order by term',
  },
  {
    in: 'query',
    name: 'limit',
    required: false,
    schema: {
      type: 'integer',
      minimum: 1,
      maximum: 1000,
    },
    description: 'Total items to return',
  },
  {
    in: 'query',
    name: 'skip',
    required: false,
    schema: {
      type: 'integer',
      minimum: 0,
    },
    description: 'Items to skip',
  },
]

/**
 * NOTE: Keep this in sync with validators in search.hooks.ts
 */
export const docs: ServiceSwaggerOptions = {
  description: 'Collectable items',
  securities: ['find', 'create', 'remove'],
  operations: {
    find: {
      description: 'Find collectable items that match the given query',
      parameters: findParameters,
      responses: getStandardResponses({
        method: 'find',
        schema: 'collectableItemsFind',
      }),
    },
  },
}
