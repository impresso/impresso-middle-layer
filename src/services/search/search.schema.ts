import { paramsValidator } from './search.validators';
import { SolrMappings } from '../../data/constants';
import { ServiceSwaggerOptions } from 'feathers-swagger';
import { JSONSchema } from 'json-schema-to-ts';

const filterSchema = require('../../schema/search/filter.json');
const articleSchema = require('../../schema/search/article.json');
articleSchema.$id = '#/components/schemas/article';
articleSchema.properties.pages.items.$ref = '#/components/schemas/page';
articleSchema.properties.locations.items.$ref = '#/components/schemas/entity';
articleSchema.properties.persons.items.$ref = '#/components/schemas/entity';

const pageSchema = require('../../schema/search/page.json');
pageSchema.$id = '#/components/schemas/page';

const entitySchema = require('../../schema/search/entity.json');
entitySchema.$id = '#/components/schemas/entity';

const responseSchema = require('../../schema/search/response.json');
responseSchema.properties.data.items.$ref = '#/components/schemas/article';

// const articleListSchema = {
//   title: 'Article list',
//   type: 'array',
//   items: { $ref: '#/components/schemas/article' }
// };

export { articleSchema, pageSchema, entitySchema };

interface QueryParameter {
  in: 'query';
  name: string;
  required: boolean;
  schema: JSONSchema;
  description: string;
}

const findParameters: QueryParameter[] = [
  {
    in: 'query',
    name: 'q',
    required: paramsValidator.q.required,
    schema: {
      type: 'string',
      minLength: 2,
      maxLength: 1000
    },
    description: 'Search query term'
  },
  {
    in: 'query',
    name: 'group_by',
    required: paramsValidator.group_by.required,
    schema: {
      type: 'string',
      enum: paramsValidator.group_by.choices
    },
    description: 'Group by term'
  },
  {
    in: 'query',
    name: 'order_by',
    required: false,
    schema: {
      type: 'string',
      enum: paramsValidator.order_by.choices
    },
    description: 'Order by term'
  },
  {
    in: 'query',
    name: 'facets',
    required: false,
    schema: {
      type: 'string',
      enum: Object.keys(SolrMappings.search.facets)
    },
    description: 'Facet to return'
  },
  {
    in: 'query',
    name: 'filters',
    required: false,
    schema: {
      type: 'array',
      items: filterSchema
    },
    description: 'Filters to apply'
  },
  {
    in: 'query',
    name: 'limit',
    required: false,
    schema: {
      type: 'integer',
      minimum: 1,
      maximum: 1000
    },
    description: 'Total items to return'
  },
  {
    in: 'query',
    name: 'skip',
    required: false,
    schema: {
      type: 'integer',
      minimum: 0
    },
    description: 'Items to skip'
  }
];

/**
 * NOTE: Keep this in sync with validators in search.hooks.ts
 */
export const docs: ServiceSwaggerOptions = {
  description: 'Search articles',
  securities: ['find'],
  schemas: { entity: entitySchema, page: pageSchema, article: articleSchema, searchList: responseSchema },
  operations: {
    find: {
      description: 'Find articles that match the given query',
      parameters: findParameters
    }
  }
};
