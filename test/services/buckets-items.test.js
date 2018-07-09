const assert = require('assert');
const app = require('../../src/app');

describe('\'buckets-items\' service', () => {
  const service = app.service('buckets-items');
  const user = {
    uid: 'local-user-test-only',
    is_staff: true,
  }

  it('registered the service', () => {
    assert.ok(service, 'Registered the service');
  });

  it('creates an empty bucket uid',  async() => {
    const customBucket = await app.service('buckets').create({
      bucket_uid: 'local-bucket-test-only',
      name: 'local-bucket-test-only',
    }, {
      user,
    });
    assert.equal(customBucket.data.name, 'local-bucket-test-only');
    assert.equal(customBucket.info._stats.nodesCreated, 1);
  });

  it('add a page and an issue to a bucket at the same time', async () => {
    const results = await service.create({
      bucket_uid: 'local-bucket-test-only',
      items: [
        {
          label: 'page',
          uid: 'GDL-1811-11-22-a-p0003',
        },

        // {
        //   label: 'page',
        //   uid: 'GDL-1950-03-29-a-p0008',
        // },
        // {
        //   label: 'article',
        //   uid: 'GDL-1950-03-29-a-i0138',
        // },
        // {
        //   label: 'article',
        //   uid: 'GDL-1950-03-29-a-i0138',
        // },
        {
          label: 'article',
          uid: 'GDL-1811-11-22-a-0002-3624301',
        },
        {
          label: 'issue',
          uid: 'GDL-1811-11-22-a',
        }
      ],
    }, {
      user,
    });
    // console.log(results);
    assert.ok(results.data);
  });

  it('checks that the issue endpoint mentions the bucket', async () => {

    const result = await app.service('issues').get('GDL-1811-11-22-a', {
      user: {
        uid: 'local-user-test-only',
      },
    });
    assert.ok(result.buckets);
  });

  it('get complete list of items', async ()=> {

    const finder = await service.find({
      user: {
        uid: 'local-user-test-only',
      },
    });

    // console.log(finder);
    assert.ok(finder)
  })

  it('add a page to the bucket then get rid of it.', async () => {


    const created = await service.create({
      bucket_uid: 'local-bucket-test-only',
      items: [{
        label: 'page',
        uid: 'GDL-1798-02-05-a-p0001',
      }],
    }, {
      user: {
        uid: 'local-user-test-only',
      },
    });
    // console.log(created);
    assert.ok(created.data[0].uid);

    const countItems = created.data[0].count_items;
    const countPages = created.data[0].count_pages;

    const removed = await service.remove(created.data[0].uid, {
      query: {
        items: [{
          label: 'page',
          uid: 'GDL-1798-02-05-a-p0001',
        }],
      },
      user: {
        uid: 'local-user-test-only',
      },
    }).catch((err) => {
      console.log(err);
    });

    assert.equal(removed.data[0].count_items, countItems - 1);
    assert.equal(removed.data[0].count_pages, countPages - 1);
    assert.equal(removed.info._stats.relationshipsDeleted, 1);
    //
    const alreadyremoved = await service.remove(created.data[0].uid, {
      query: {
        items: [{
          label: 'page',
          uid: 'GDL-1798-02-05-a-p0001',
        }],
      },
      user: {
        uid: 'local-user-test-only',
      },
    }).catch((err) => {
      console.log(err);
    });

    assert.equal(removed.data[0].count_pages, countPages - 1);
    assert.equal(alreadyremoved.info._stats.relationshipsDeleted, 0);
    // console.log(alreadyremoved);
  });

  it('delete the created bucket uid ...',  async() => {
    const removedBucket = await app.service('buckets').remove('local-bucket-test-only', {
      user,
    });
    assert.equal(removedBucket.nodesDeleted, 1);
    assert.ok(removedBucket.relationshipsDeleted);
    assert.ok(removedBucket.propertiesSet);
  });
});
