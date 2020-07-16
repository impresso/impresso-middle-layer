const assert = require('assert');
const app = require('../../src/app');

describe('\'entities-mentions\' service', () => {
  it('registered the service', () => {
    const service = app.service('entities-mentions');

    assert.ok(service, 'Registered the service');
  });
});
