const assert = require('assert');
const app = require('../../../src/app');
/**
 *
./node_modules/.bin/eslint \
src/services/version test/services/version.test.js --fix &&
mocha test/services/version.test.js

*/
describe('\'version\' service', () => {
  const service = app.service('version');

  it('registered the service', () => {
    assert.ok(service, 'Registered the service');
  });

  it('get the current version', async () => {
    const result = await app.service('version').find();
    assert.ok(result.version, 'check that there is a version');
    assert.strictEqual(result.solr.dataVersion, app.get('solr').dataVersion);
  });
});
