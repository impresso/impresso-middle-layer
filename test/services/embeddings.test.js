const assert = require('assert');
const app = require('../../src/app');

describe('\'embeddings\' service', () => {
  it('registered the service', () => {
    const service = app.service('embeddings');

    assert.ok(service, 'Registered the service');
  });
});
