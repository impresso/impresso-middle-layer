const assert = require('assert');
const app = require('../../src/app');

describe('\'init\' service', () => {
  it('registered the service', () => {
    const service = app.service('init');

    assert.ok(service, 'Registered the service');
  });
});
