const assert = require('assert');
const app = require('../../src/app');


/**
 * use with
  ./node_modules/.bin/eslint test/services/buckets.test.js \
  src/services/buckets --fix && DEBUG=impresso/* mocha test/services/buckets.test.js
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
      assert.fail(err);
    });

    result.items.forEach((d) => {
      if (d.labels.indexOf('page') !== -1) {
        assert.ok(d.iiif_thumbnail, 'page item should have a IIIF thumbnail');
      } else if (d.labels.indexOf('issue') !== -1) {
        assert.ok(d.iiif_thumbnail, 'issue item should have a IIIF thumbnail');
        assert.ok(d.cover.iiif_thumbnail, 'issue cover item should have a IIIF thumbnail');
        assert.ok(d.cover.iiif, 'issue cover item should have a IIIF thumbnail');
      } else if (d.labels.indexOf('article') !== -1) {
        assert.ok(d.pages[0].iiif_thumbnail, 'issue item should have a IIIF thumbnail');
      }
    });

    assert.equal(result.labels[0], 'bucket');

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
