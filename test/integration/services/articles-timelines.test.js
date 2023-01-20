const assert = require('assert');
const app = require('../../../src/app');

/*
./node_modules/.bin/eslint \
test/services/articles-timelines.test.js \
src/services/articles-timelines \
src/models src/hooks \
--config .eslintrc.json --fix \
&& NODE_ENV=test DEBUG=impresso* mocha test/services/articles-timelines.test.js
*/

describe('\'articles-timelines\' service', function () {
  this.timeout(5000);
  const service = app.service('articles-timelines');

  it('registered the service', () => {
    assert.ok(service, 'Registered the service');
  });

  it('should filter timeline based on topic uid', async () => {
    const results = await service.get('stats', {
      query: {
        filters: [{
          type: 'topic',
          q: 'tmLETEMPS_tp23_fr',
        }],
      },
    });
    assert.ok(results);
    assert.ok(results.values[0].w);
    assert.ok(results.format);
  });

  it('should handle empty filtered timeline', async () => {
    const results = await service.get('stats', {
      query: {
        filters: [{
          type: 'topic',
          q: 'thisTopicDoesNotExist',
        }],
      },
    });
    assert.ok(results.values[0].w);
    assert.equal(results.extents.w1.join(','), '0,0');
  });
});
