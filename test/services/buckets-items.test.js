const assert = require('assert');
const app = require('../../src/app');

describe('\'buckets-items\' service', () => {
  const service = app.service('buckets-items');

  it('registered the service', () => {
    assert.ok(service, 'Registered the service');
  });

  it('add a page and an issue to a bucket at the same time', async () => {
    const results = await service.create({
      bucket_uid: 'local-bucket-test-only',
      items: [{
        label: 'page',
        uid: 'GDL-1811-11-22-a-p0001',
      },
      {
        label: 'page',
        uid: 'GDL-1950-03-29-a-p0008',
      },
      {
        label: 'article',
        uid: 'GDL-1950-03-29-a-i0138',
      },
      {
        label: 'issue',
        uid: 'GDL-1811-11-22-a',
      }],
    }, {
      user: {
        uid: 'local-user-test-only',
      },
    });
    assert.ok(results.data);
  });

  it('checks that the issue endpoint mentions the bucket', async () => {
    const result = await app.service('issues').get('GDL-1811-11-22-a', {
      user: {
        uid: 'local-user-test-only',
      },
    });

    console.log(result);
  });

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

    assert.ok(created.data[0].uid);

    const removed = await service.remove(created.data[0].uid, {
      query: {
        items: [{
          label: 'page',
          uid: 'GDL-1798-02-05-a-p0001',
        }],
      },
    }).catch((err) => {
      console.log(err);
    });
    console.log(removed);
  });
});
