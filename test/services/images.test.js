const assert = require('assert');
const app = require('../../src/app');

/**
./node_modules/.bin/eslint \
test/services/images.test.js \
src/services/images \
--config .eslintrc.json --fix \
&& NODE_ENV=production DEBUG=impresso* mocha test/services/images.test.js
*/
describe('\'images\' service', () => {
  const service = app.service('images');


  it('registered a working service', () => {
    assert.ok(service, 'Registered the service');
  });


  it('call find method with basic filter', async () => {
    const result = await service.find({
      query: {
        filters: [
          {
            type: 'newspaper',
            q: ['GDL'],
          },
          {
            type: 'year',
            q: [1970, 1971],
          },
        ],
      },
    });
    assert.ok(result.data, 'theres data');
    assert.deepEqual(result.info.queryComponents[0].items[0].name, 'Gazette de Lausanne', 'newspaper has been translated to an item');
    assert.deepEqual(result.info.filters[1].q.join(','), '1970,1971', 'filters should be given in info');
  });

  it('find similar images to', async () => {
    const result = await service.find({
      query: {
        similarTo: 'GDL-1950-12-23-a-i0107', // 'GDL-1950-03-28-a-i0103',
        filters: [
          {
            type: 'newspaper',
            q: ['GDL'],
          },
          {
            type: 'year',
            q: [1970],
          },
        ],
      },
    });
    assert.ok(result.data, 'theres data');
    assert.deepEqual(result.limit, 10);
    assert.deepEqual(result.skip, 0);
    assert.deepEqual(result.info.queryComponents[0].items[0].name, 'Gazette de Lausanne', 'newspaper has been translated to an item');
    assert.ok(result);
  });
});
