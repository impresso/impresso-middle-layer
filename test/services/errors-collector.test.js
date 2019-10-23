const assert = require('assert');
const app = require('../../src/app');

describe('\'errors-collector\' service', () => {
  it('registered the service', () => {
    const service = app.service('errors-collector');

    assert.ok(service, 'Registered the service');
  });
});
