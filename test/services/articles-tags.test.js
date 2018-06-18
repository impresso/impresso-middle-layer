const assert = require('assert');
const app = require('../../src/app');

describe('\'articles-tags\' service', () => {
  it('registered the service', () => {
    const service = app.service('articles-tags');
    assert.ok(service, 'Registered the service');
  });
});
