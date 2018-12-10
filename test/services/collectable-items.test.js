const assert = require('assert');
const app = require('../../src/app');

/*
  ./node_modules/.bin/eslint \
  test/services/collectable-items.test.js \
  src/services/collectable-items src/models/collectable-items.model.js --fix \
  && DEBUG=impresso* mocha test/services/collectable-items.test.js
*/
describe('\'collectable-items\' service', function () {
  this.timeout(15000);
  const service = app.service('collectable-items');

  it('registered the service', () => {
    assert.ok(service, 'Registered the service');
  });

  it('create an entry item for the current user', async () => {
    const results = await service.create({
      collection_uid: 'local-abc-collection',
      items: [
        {
          uid: 'GDL50',
          content_type: 'article',
        },
      ],
    }, {
      user: {
        id: 95,
      },
    });
    console.log(results);
  });

  it.only('find all items for the current user', async () => {
    const results = await service.find({
      query: {},
      user: {
        id: 95,
      },
    });
    console.log(results);
  });


  it('find all items for the current user for the given item uid', async () => {
    const results = await service.find({
      query: {
        uid: '',
      },
      user: {
        id: 95,
      },
    });
    console.log(results);
  });

  it('remove an article from a collection', async () => {
    const results = await service.remove('local-abc-collection', {
      query: {
        collection_uid: 'local-abc-collection',
        items: [
          {
            uid: 'GDL50',
          },
        ],
      },
      user: {
        id: 95,
      },
    });
    assert.equal(results.removed, 1);
    assert.ok(results);
  });
});
