const assert = require('assert');
const app = require('../../src/app');

describe('\'table-of-contents\' service', () => {
  it('registered the service', () => {
    const service = app.service('table-of-contents');

    assert.ok(service, 'Registered the service');
  });
});
