const assert = require('assert');
const app = require('../../src/app');

describe('\'search-queries-comparison\' service', () => {
  it('registered the service', () => {
    const service = app.service('search-queries-comparison');

    assert.ok(service, 'Registered the service');
  });
});
