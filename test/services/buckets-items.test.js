const assert = require('assert');
const app = require('../../src/app');

describe('\'buckets-items\' service', () => {
  it('registered the service', () => {
    const service = app.service('buckets-items');

    assert.ok(service, 'Registered the service');
  });
});
