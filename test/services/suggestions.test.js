const assert = require('assert');
const app = require('../../src/app');

describe('\'suggestions\' service', () => {
  it('registered the service', () => {
    const service = app.service('suggestions');

    assert.ok(service, 'Registered the service');
  });
});
