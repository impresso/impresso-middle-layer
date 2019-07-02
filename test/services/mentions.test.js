const assert = require('assert');
const app = require('../../src/app');

/*
./node_modules/.bin/eslint  \
src/services/mentions \
src/models/entity-mentions.model.js \
test/services/mentions.test.js \
src/hooks/sequelize.js \
src/hooks/resolvers/mentions.resolvers.js \
--config .eslintrc.json --fix \
&& NODE_ENV=development DEBUG=verbose*,imp*,@feathersjs/error* mocha test/services/mentions.test.js
*/
describe('\'mentions\' service', function () {
  this.timeout(10000);

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
  });

  it('find mentions for a specific entity', async () => {
    const result = await service.find({
      query: {
        order_by: 'name',
        filters: [
          {
            type: 'entity',
            q: 'aida-0001-"Arizona"_Charlie_Meadows',
          },
        ],
      },
    }).catch((err) => {
      console.log(err);
    });
    assert.ok(result.total, 'there are results');
    assert.ok(result.data[0].articleUid, 'there should be an article attached');
    assert.ok(result.data[0].article.uid, 'there is an article attached');
  });
});
