const assert = require('assert');
const app = require('../../src/app');

describe('\'suggestions\' service', () => {
  it('registered the service', () => {
    const service = app.service('suggestions');

    assert.ok(service, 'Registered the service');
  });

  it('say hello', (done) => {
    app.service('suggestions').find({q: ''}).then(result => {
      assert.ok()
      done();
    }).catch(done);

  })
});
