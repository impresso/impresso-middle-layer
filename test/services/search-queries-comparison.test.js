const assert = require('assert');
const app = require('../../src/app');
const {
  intersectionRequestToSolrQuery,
  DefaultSolrFieldsFilter,
} = require('../../src/services/search-queries-comparison/search-queries-comparison.class');
const hooks = require('../../src/services/search-queries-comparison/search-queries-comparison.hooks');

describe('\'search-queries-comparison\' service', () => {
  it('registered the service', () => {
    const service = app.service('search-queries-comparison');
    assert.ok(service, 'Registered the service');
  });
});

describe('intersectionRequestToSolrQuery', () => {
  it('builds a basic query', () => {
    const request = {
      queries: [
        {
          filters: [
            { type: 'person', q: ['Bonnie', 'Clyde'], op: 'AND' },
          ],
        },
        {
          filters: [
            { type: 'newspaper', q: 'NYT' },
          ],
        },
      ],
    };
    const expectedPayload = {
      fl: DefaultSolrFieldsFilter,
      q: 'filter(pers_entities_dpfs:Bonnie AND pers_entities_dpfs:Clyde) AND filter(meta_journal_s:NYT)',
    };

    const payload = intersectionRequestToSolrQuery(request);
    assert.deepEqual(payload, expectedPayload);
  });

  it('builds a query with all parameters', () => {
    const request = {
      queries: [
        {
          filters: [
            { type: 'collection', q: 'A' },
          ],
        },
        {
          filters: [
            { type: 'collection', q: 'B' },
          ],
        },
      ],
      skip: 5,
      limit: 3,
      order_by: 'id',
      facets: 'test',
    };
    const expectedPayload = {
      fl: DefaultSolrFieldsFilter,
      q: 'filter(ucoll_ss:A AND ucoll_ss:B)',
      limit: 3,
      skip: 5,
      order_by: 'id',
      facets: 'test',
    };

    const payload = intersectionRequestToSolrQuery(request);
    assert.deepEqual(payload, expectedPayload);
  });

  it('fails to builds a query with wrong filter types', () => {
    const request = {
      queries: [
        {
          filters: [
            { type: 'foobar', q: 'A' },
          ],
        },
        {
          filters: [
            { type: 'collection', q: 'B' },
          ],
        },
      ],
    };

    assert.throws(
      () => intersectionRequestToSolrQuery(request),
      {
        message: 'reduceFilterToSolr: filter function for \'foobar\' not found',
      },
    );
  });
});

describe('post hooks sequence', () => {
  it('generates correct request for valid payload', async () => {
    const context = {
      params: {
        query: {
          method: 'intersection',
        },
      },
      data: {
        queries: [
          {
            filters: [{ type: 'topic', q: 'AA' }],
          },
          {
            filters: [{ type: 'topic', q: 'BB' }],
          },
        ],
      },
    };

    await Promise.all(hooks.before.create.map(async (hook) => {
      await hook(context);
      return context;
    }));

    const expectedPayload = {
      limit: 10,
      max_limit: 1000,
      skip: 0,
      queries: [
        {
          filters: [{
            type: 'topic', q: 'AA', op: 'OR', context: 'include',
          }],
        },
        {
          filters: [{
            type: 'topic', q: 'BB', op: 'OR', context: 'include',
          }],
        },
      ],
    };
    assert.deepEqual(context.data.sanitized, expectedPayload);
  });

  it('throws "BadRequest" when payload does not match schema', async () => {
    const context = {
      params: {
        query: {
          method: 'intersection',
        },
      },
      data: {
        queries: [],
      },
    };

    await assert.rejects(
      Promise.all(hooks.before.create.map(async (hook) => {
        await hook(context);
        return context;
      })),
      {
        code: 400,
        message: 'JSON validation errors: data.queries should NOT have fewer than 2 items',
      },
    );
  });
});
