const assert = require('assert');
const app = require('../../src/app');

describe('\'text-reuse-clusters\' service', () => {
  it('registered the service', () => {
    const service = app.service('text-reuse-clusters');

    assert.ok(service, 'Registered the service');
  });
});
