const assert = require('assert');
const app = require('../../src/app');

/**
./node_modules/.bin/eslint \
test/services/articles-suggestions.test.js \
src/services/articles-suggestions \
--config .eslintrc.json --fix \
&& NODE_ENV=production DEBUG=impresso* mocha test/services/articles-suggestions.test.js
*/
describe('\'articles-suggestions\' service', () => {
  const service = app.service('articles-suggestions');

  it('registered the service', () => {
    assert.ok(service, 'Registered the service');
  });

  it('given a first article, get top similar articles', async () => {
    const results = await service.get('IMP-1975-04-09-a-i0219');
    assert.ok(results.total);
    assert.ok(results.data);
  });
});
