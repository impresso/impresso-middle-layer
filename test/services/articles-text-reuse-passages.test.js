const assert = require('assert');
const app = require('../../src/app');

describe('\'articles-text-reuse-passages\' service', () => {
  it('registered the service', () => {
    const service = app.service('articles/:id/text-reuse-passages');

    assert.ok(service, 'Registered the service');
  });
});
