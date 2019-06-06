const assert = require('assert');
const app = require('../../src/app');

/*
./node_modules/.bin/eslint  \
src/services/mentions src/models/entity-mentions.model.js \
--config .eslintrc.json --fix \
&& NODE_ENV=development DEBUG=verbose*,imp* mocha test/services/mentions.test.js
*/
describe('\'mentions\' service', () => {
  const service = app.service('mentions');

  it('registered the service', () => {
    assert.ok(service, 'Registered the service');
  });

  it('find', async () => {
    const result = await service.find({
      query: {
        order_by: 'name',
      },
    });
    assert.ok(result.total);
    assert.ok(result.data);

    console.log(result);
  });
});
