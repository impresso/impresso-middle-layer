const assert = require('assert');
const app = require('../../src/app');
const Newspaper = require('../../src/models/newspapers.model');
/**
./node_modules/.bin/eslint  \
src/models src/services/newspapers src/hooks test/services/newspapers.test.js \
--config .eslintrc.json --fix \
&& DEBUG=impresso* mocha test/services/newspapers.test.js
*/
describe('\'newspapers\' service', function () {
  this.timeout(15000);
  const service = app.service('newspapers');

  it('registered the service', async () => {
    assert.ok(service, 'Registered the service');
  });

  it('get newspapers!', async () => {
    const results = await service.find({
      query: {},
    });

    assert.ok(results.total > 0, 'has a total greater than zero');
    assert.ok(results.data[0] instanceof Newspaper, 'is an instance of Newspaper');
  });
  it('get newspapers containing "gazette"!', async () => {
    const results = await service.find({
      query: {
        q: 'gazette',
      },
    });
    assert.ok(results.total > 0, 'has a total greater than zero');
    assert.ok(results.data[0] instanceof Newspaper, 'is an instance of Newspaper');
  });
});
