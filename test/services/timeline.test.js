const assert = require('assert');
const app = require('../../src/app');

describe('\'timeline\' service', () => {
  it('registered the service', () => {
    const service = app.service('timeline');

    assert.ok(service, 'Registered the service');
  });
});
