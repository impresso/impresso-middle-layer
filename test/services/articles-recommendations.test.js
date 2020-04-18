const assert = require('assert');
const app = require('../../src/app');

describe('\'articles-recommendations\' service', () => {
  it('registered the service', () => {
    const service = app.service('articles-recommendations');

    assert.ok(service, 'Registered the service');
  });
});
