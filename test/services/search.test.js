const assert = require('assert');
const app = require('../../src/app');


/**
 * Test for search endpoint. Usage:
 * ```
 * ./node_modules/.bin/eslint src/services/search --fix && DEBUG=impresso/* mocha test/services/search.test.js
 * ```
 */
describe('\'search\' service', function(){
  const service = app.service('search');
  const staff = {
    uid: 'local-user-test-only',
    is_staff: true,
  };

  it('registered the service', () => {
    assert.ok(service, 'Registered the service');
  });

  it('get search results when no filters is given', async () => {
    return;
    const result = await service.find({
      query: {
        group_by: 'articles',
        facets: ['year'],
      },
    });
    assert.ok(result.info.queryComponents);
    assert.ok(result.info.facets.year);
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
    //console.log(result.info)
    assert.ok(result.info.facets.year);
  });

  it('loaded solr content', async () => {
    const results = await service.find({
      query: {
        q: 'avion accident',
        group_by: 'articles',
        facets: ['year'],
      },
    }).catch((err) => {
      assert.empty(err);
      done();
    });

    assert.ok(results.data.length);

  });

  it('loaded solr content, filters & facets, with current user having a bucket ;)', async () => {
    // remove the bucket if any
    const removedBucket = await app.service('buckets').remove('local-bucket-test-only', {
      user: staff,
    });
    assert.ok(removedBucket);

    // create a bucket for the user staff. Beign staff allows to create buckets with a given name.
    const createBucket = await app.service('buckets').create({
        bucket_uid: 'local-bucket-test-only',
        name: 'local-bucket-test-only',
      }, {
        user: staff,
      });

    assert.equal(createBucket.data.uid, 'local-bucket-test-only');
    assert.equal(createBucket.data.name, 'local-bucket-test-only');
    assert.equal(createBucket.info._stats.nodesCreated, 1);

    const createBucketsItems = await app.service('buckets-items').create({
      bucket_uid: createBucket.data.uid,
      items: [{
        label: 'article',
        uid: 'GDL-1950-03-29-a-i0138',
      }],
    }, {
      user: staff
    }).catch(d => {
      console.log(d);
      throw 'stop'
    });
    // save article to buckets

    const res = await service.find({
      query: {
        q: 'ambassad*',
        group_by: 'articles',
        limit: 3,
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

    //console.log(res.data[0]);
    assert.ok(res.data.length);
    assert.ok(res.data[0].matches.length);
    if (res.data[0].uid === 'GDL-1950-03-29-a-i0138') {
      assert.equal(res.data[0].buckets.length > 0, true);
    }
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
