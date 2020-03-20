const assert = require('assert');
const app = require('../../src/app');

describe('\'temporal-stats\' service', () => {
  it('registered the service', () => {
    const service = app.service('temporal-stats');

    assert.ok(service, 'Registered the service');
  });
});
