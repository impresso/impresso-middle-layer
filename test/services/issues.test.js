const assert = require('assert');
const app = require('../../src/app');

/**
 * use with
  ./node_modules/.bin/eslint test/services/issues.test.js  \
  src/services/issues src/hooks --fix && DEBUG=impresso/* mocha test/services/issues.test.js
 */
describe('\'issues\' service', () => {
  const service = app.service('issues');

  it('registered the service', () => {
    assert.ok(service, 'Registered the service');
  });

  it('it should load issues', async () => {
    const result = await service.get('GDL-1811-11-22-a', {
    }).catch((err) => {
      console.log(err);
    });
    assert.ok(result);
    assert.ok(result.pages[0].iiif, 'pages[0] contains IIIF');
    assert.ok(result.pages[0].iiif_thumbnail, 'pages[0] contains IIIF thumb');
    assert.ok(!result.buckets.length);
  });
});
