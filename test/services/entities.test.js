const assert = require('assert');
const app = require('../../src/app');

describe('\'entities\' service', () => {
  it('registered the service', () => {
    const service = app.service('entities');

    assert.ok(service, 'Registered the service');
  });
});
