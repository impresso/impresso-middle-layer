const assert = require('assert');
const app = require('../../src/app');


/**
 * use with
 * DEBUG=impresso/* ./node_modules/.bin/eslint test/services/buckets.test.js \
 *  src/services/buckets --fix && DEBUG=impresso/* mocha test/services/buckets.test.js
 */
describe('\'buckets\' service', () => {
  const service = app.service('buckets');
  const user = {
    uid: 'local-user-test-only',
    is_staff: true,
  };

  it('registered the service', () => {
    assert.ok(service, 'Registered the service');
  });

  it('creates an empty bucket uid', async () => {
    const customBucket = await service.create({
      bucket_uid: 'local-bucket-test-only',
      name: 'local-bucket-test-only',
    }, {
      user,
    });
    assert.equal(customBucket.data.name, 'local-bucket-test-only');
    assert.equal(customBucket.info._stats.nodesCreated, 1);
  });

  it('add a page and an issue to a bucket at the same time', async () => {
    const results = await app.service('buckets-items').create({
      bucket_uid: 'local-bucket-test-only',
      items: [
        {
          label: 'page',
          uid: 'GDL-1811-11-22-a-p0003',
        },
        {
          label: 'article',
          uid: 'GDL-1954-06-29-a-i0084',
        },
        {
          label: 'issue',
          uid: 'GDL-1811-11-22-a',
        },
      ],
    }, {
      user,
    });

    assert.equal(results.info._stats.relationshipsCreated, 3);
    assert.ok(results.data);
  });

  it('get a single bucket', async () => {
    const result = await service.get('local-bucket-test-only', {
      user,
    }).catch((err) => {
      console.log(err);
    });
    console.log('\n\n\n------------------------------------------', result);
    assert.equal(result.labels[0], 'bucket');

    assert.ok(result.items[1].cover);
    assert.equal(result.uid, 'local-bucket-test-only');
  });
  //
  it('get a list of buckets', async () => {
    const results = await service.find({
      query: {}, // for parameter "q"
      user: {
        uid: 'local-user-test-only',
      },
    });
    assert.ok(results.data);
    assert.ok(results.total);
  });

  it('delete the created bucket uid ...', async () => {
    const removedBucket = await app.service('buckets').remove('local-bucket-test-only', {
      user,
    });
    assert.equal(removedBucket.nodesDeleted, 1);
    assert.ok(removedBucket.relationshipsDeleted);
    assert.ok(removedBucket.propertiesSet);
  });
});
