const assert = require('assert');
const app = require('../../src/app');

describe('\'buckets\' service', () => {
  it('registered the service', () => {
    const service = app.service('buckets');

    assert.ok(service, 'Registered the service');
  });

  it('get correctly a test bucket for a test user (both in the db)', () => {
    const service = app.service('buckets');

    service.find({limit: 10}).then(res => {
      console.log(res)
      assert.ok(service, 'Registered the service');
    }).catch(err => {
      assert.empty(err, 'Registered the service');
    })

  });
});
