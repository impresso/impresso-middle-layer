const assert = require('assert');
const app = require('../../src/app');

describe('\'newspapers\' service', () => {
  it('registered the service', () => {
    const service = app.service('newspapers');

    assert.ok(service, 'Registered the service');
  });
});
