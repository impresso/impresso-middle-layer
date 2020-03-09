const assert = require('assert');
const app = require('../../src/app');

describe('\'text-reuse-cluster-passages\' service', () => {
  it('registered the service', () => {
    const service = app.service('text-reuse-cluster-passages');

    assert.ok(service, 'Registered the service');
  });
});
