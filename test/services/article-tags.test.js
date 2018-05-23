const assert = require('assert');
const app = require('../../src/app');

describe('\'article-tags\' service', () => {
  it('registered the service', () => {
    const service = app.service('article-tags');

    assert.ok(service, 'Registered the service');
  });
});
