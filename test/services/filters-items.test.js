const assert = require('assert');
const app = require('../../src/app');

describe('\'filters-items\' service', () => {
  it('registered the service', () => {
    const service = app.service('filters-items');

    assert.ok(service, 'Registered the service');
  });
});
