const assert = require('assert');
const app = require('../../src/app');


/**
 * Test for search endpoint. Usage: ``` DEBUG=impresso/* mocha test/services/search.test.js ```
 */
describe('\'search\' service', () => {
  const service = app.service('search');

  it('registered the service', () => {
    assert.ok(service, 'Registered the service');
  });
  it('get search results with daterange filters', async () => {
    const result = await service.find({
      query: {
        group_by: 'articles',
        facets: ['year'],
        filters: [{
            type: 'daterange',
            context: 'exclude',
            daterange: '1952-01-01T00:00:00Z TO 1953-01-01T00:00:00Z',
          },
          {
            type: 'daterange',
            context: 'include',
            daterange: '1950-01-01T00:00:00Z TO 1958-01-01T00:00:00Z',
          }
        ],
      },
    });
    // console.log(result.info)
    assert.ok(result.info.facets.year);
  });
  it('loaded solr content', (done) => {
    service.find({
      query: {
        q: 'avion accident',
        group_by: 'articles',
        facets: ['year'],
      },
    }).then((res) => {
      assert.ok(res.data.length);
      done();
    }).catch((err) => {
      assert.empty(err);
      done();
    });
  });

  it('loaded solr content, filters & facets, with current user having a bucket ;)', async () => {
    const res = await service.find({
      query: {
        q: 'ambassad*',
        group_by: 'articles',
        limit: 1,
        facets: [
          'language',
        ],
        filters: [
          {
            type: 'string',
            context: 'include',
            q: 'avion accident',
          },
          {
            type: 'string',
            context: 'exclude',
            q: 'suisse',
          },
        ],
      },
      user: {
        uid: 'local-user-test-only',
      },
    }).catch((err) => {
      console.log(err.data);
    });

    console.log(res.data[0]);
    assert.ok(res.data.length);
    assert.ok(res.data[0].matches.length);
    if (res.data[0].uid === 'GDL-1950-03-29-a-i0138') {
      assert.equal(res.data[0].buckets.length, 1);
    }

    // assert.ok(service, 'Registered the service');
  });

  it('load solr content sorted by date', async () => {
    const res = await service.find({
      query: {
        q: 'ambassad*',
        group_by: 'articles',
        order_by: '-date,-relevance',
        limit: 1,
        facets: [
          'language',
        ],
        filters: [
          {
            type: 'string',
            context: 'include',
            q: 'avion accident',
          },
        ],
      },
      user: {
        uid: 'local-user-test-only',
      },
    }).catch((err) => {
      console.log(err.data);
    });
    console.log(res);
  });
});
