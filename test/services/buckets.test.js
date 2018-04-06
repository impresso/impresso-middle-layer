const assert = require('assert');
const app = require('../../src/app');

describe('\'buckets\' service', () => {
  it('registered the service', () => {
    const service = app.service('buckets');

    assert.ok(service, 'Registered the service');
  });
});
