const assert = require('assert');
const app = require('../../src/app');

/**
 * use with
  ./node_modules/.bin/eslint test/services/exporter.test.js  \
  src/services/exporter src/hooks --fix \
  && DEBUG=impresso/* mocha test/services/exporter.test.js
 */
describe('\'exporter\' service', () => {
  const service = app.service('exporter');

  it('registered the service', () => {
    assert.ok(service, 'Registered the service');
  });

  it('given a search, return the metadata', async () => {
    const results = await service.get('search', {
      query: {
        format: 'csv',
      },
    });
    console.log(results);
    assert.ok(service, 'Registered the service');
  });
});
