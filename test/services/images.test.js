const assert = require('assert');
const app = require('../../src/app');

/**
./node_modules/.bin/eslint \
 test/services/images.test.js \
 src/services/images \
 src/models src/hooks \
 --config .eslintrc.json --fix \
 && NODE_ENV=test DEBUG=impresso* mocha test/services/images.test.js
*/
describe('\'images\' service', () => {
  const service = app.service('images');

  it('registered a working service', async () => {
    const result = await service.find({});
    assert.ok(service, 'Registered the service');
    assert.ok(result, 'find method called');
  });
});
