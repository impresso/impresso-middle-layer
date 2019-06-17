const assert = require('assert');
const app = require('../../src/app');

describe('\'filepond\' service', () => {
  it('registered the service', () => {
    const service = app.service('filepond');

    assert.ok(service, 'Registered the service');
  });
});
