const assert = require('assert');
const app = require('../../src/app');

describe('\'me\' service', () => {
  it('registered the service', () => {
    const service = app.service('me');

    assert.ok(service, 'Registered the service');
  });
});
