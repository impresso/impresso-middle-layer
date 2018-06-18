const assert = require('assert');
const app = require('../../src/app');

describe('\'suggestions\' service', () => {
  it('registered the service', () => {
    const service = app.service('suggestions');

    assert.ok(service, 'Registered the service');
  });

  it('say hello', (done) => {
    app.service('suggestions').find({
      query: {
        q: 'pau',
      },
    }).then((result) => {
      assert.ok(result.data, 'should contain a list of stuffs');
      done();
    }).catch(done);
  });
});
