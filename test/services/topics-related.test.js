const assert = require('assert');
const app = require('../../src/app');

describe('\'topics-graph\' service', () => {
  it('registered the service', () => {
    const service = app.service('topics-graph');

    assert.ok(service, 'Registered the service');
  });
});
