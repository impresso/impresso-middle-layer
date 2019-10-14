const assert = require('assert');
const app = require('../../src/app');

describe('\'search-queries\' service', () => {
  it('registered the service', () => {
    const service = app.service('search-queries');

    assert.ok(service, 'Registered the service');
  });
});
