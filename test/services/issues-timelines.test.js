const assert = require('assert');
const app = require('../../src/app');

describe('\'issues-timelines\' service', () => {
  it('registered the service', () => {
    const service = app.service('issues-timelines');

    assert.ok(service, 'Registered the service');
  });
});
