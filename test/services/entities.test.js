const assert = require('assert');
const app = require('../../src/app');
/**
./node_modules/.bin/eslint \
test/services/entities.test.js \
src/services/entities \
src/models/entities.model.js \
--config .eslintrc.json --fix \
&& NODE_ENV=development DEBUG=@feathersjs/error*,impresso* mocha test/services/entities.test.js
*/
describe('\'entities\' service', function () {
  this.timeout(10000);
  const service = app.service('entities');

  it('registered the service', () => {
    assert.ok(service, 'Registered the service');
  });

  it('test find method', async () => {
    const result = await service.find();
    assert.ok(result.data);
  });

  it('test get method', async () => {
    const result = await service.get('aida-0001-"Arizona"_Charlie_Meadows');
    assert.ok(result.wikidata.images, 'Entity 1 must contain wikidata as it has wikidata id');
  });

  it('test get method with a location', async () => {
    const entity = await service.get('aida-0001-Berlin');
    assert.strictEqual(entity.name, 'Berlin');
    assert.strictEqual(entity.type, 'location');
    assert.strictEqual(entity.wikidataId, 'Q64');
    assert.strictEqual(entity.uid, 'aida-0001-Berlin');
    assert.ok(entity.wikidata.images, 'Entity 1 must contain wikidata as it has wikidata id');
  });
});
