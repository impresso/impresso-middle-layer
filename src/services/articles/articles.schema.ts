import { ServiceSwaggerOptions } from 'feathers-swagger';
import { QueryParameter } from '../../types';
import { REGEX_UID } from '../../hooks/params';

const findParameters: QueryParameter[] = [
  {
    in: 'query',
    name: 'resolve',
    required: false,
    schema: {
      type: 'string',
      enum: ['collection', 'tags'],
    },
    description: 'TODO',
  },
  {
    in: 'query',
    name: 'order_by',
    required: false,
    schema: {
      type: 'string',
      enum: ['-date', 'date', '-relevance', 'relevance'],
    },
    description: 'Order by term',
  },
  {
    in: 'query',
    name: 'filters',
    required: false,
    schema: {
      type: 'object',
      additionalProperties: false,
      required: ['type'],
      properties: {
        type: {
          type: 'string',
          enum: ['uid', 'issue', 'page', 'newspaper', 'hasTextContents'],
        },
        q: {
          type: 'string',
          pattern: String(REGEX_UID),
        },
      },
    },
    description: 'Filters to apply',
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
];

/**
 * NOTE: Keep this in sync with validators in search.hooks.ts
 */
export const docs: ServiceSwaggerOptions = {
  description: 'Articles',
  securities: ['find', 'get'],
  refs: { getResponse: 'article', findResponse: 'searchList' },
  operations: {
    find: {
      description: 'Find articles that match the given query',
      parameters: findParameters,
    },
  },
};
