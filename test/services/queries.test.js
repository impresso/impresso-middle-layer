const assert = require('assert');
const app = require('../../src/app');

describe('\'queries\' service', () => {
  it('registered the service', () => {
    const service = app.service('queries');

    assert.ok(service, 'Registered the service');
  });
});
