const assert = require('assert');
const app = require('../../src/app');

describe('\'buckets\' service', () => {
  const service = app.service('buckets');

  it('registered the service', () => {
    assert.ok(service, 'Registered the service');
  });

  it('get a single bucket', async () => {
    const result = await service.get('local-bucket-test-only', {
      user: {
        uid: 'local-user-test-only',
      },
    });
    console.log(result);
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
});
