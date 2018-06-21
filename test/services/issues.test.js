const assert = require('assert');
const app = require('../../src/app');

describe('\'issues\' service', () => {
  const service = app.service('issues');

  it('registered the service', () => {
    assert.ok(service, 'Registered the service');
  });

  it('it should load issues', async () => {
    const result = await service.get('GDL-1811-11-22-a', {
      user: {
        uid: 'local-user-test-only',
      },
    }).catch((err) => {
      console.log(err);
    });

    assert.ok(result);
    assert.equal(result.buckets.length, 1);
  });
});
