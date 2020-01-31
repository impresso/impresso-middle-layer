const assert = require('assert');
const app = require('../../src/app');

describe('\'topics-related\' service', () => {
  it('registered the service', () => {
    const service = app.service('topics-related');

    assert.ok(service, 'Registered the service');
  });
});
