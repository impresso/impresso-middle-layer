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

  it('get single newspaper', async () => {
    const result = await service.get('JDG');
    assert.ok(result);
  });

  it('get newspapers!', async () => {
    const results = await service.find({
      query: {},
    });

    assert.ok(results.total > 0, 'has a total greater than zero');
    if (!results.cached) {
      assert.ok(results.data[0] instanceof Newspaper, 'is an instance of Newspaper');
    } else {
      assert.ok(results.data[0].acronym, 'is a valid newspaper');
    }
  });
  it('get newspapers containing "gazette", ordered by start year!', async () => {
    const results = await service.find({
      query: {
        q: 'gazette',
        order_by: 'startYear',
      },
    });
    assert.ok(results.total > 0, 'has a total greater than zero');
    if (!results.cached) {
      assert.ok(results.data[0] instanceof Newspaper, 'is an instance of Newspaper');
    } else {
      assert.ok(results.data[0].acronym, 'is a valid newspaper');
    }
  });
});
