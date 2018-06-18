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

  it('loaded solr content with filters and facets', (done) => {
    service.find({
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
    }).then((res) => {
      // console.log(res.data);
      assert.ok(res.data.length);
      assert.ok(res.data[0].matches.length);
      done();
    }).catch((err) => {
      console.log(err.data);
      done();
    });
    assert.ok(service, 'Registered the service');
  });
});
