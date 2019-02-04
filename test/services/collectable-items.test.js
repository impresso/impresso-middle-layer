const assert = require('assert');
const app = require('../../src/app');
const { generateUser, removeGeneratedUser } = require('./utils');

/*
  ./node_modules/.bin/eslint \
  test/services/collectable-items.test.js \
  src/services/collectable-items \
  src/models/collectable-items.model.js \
  --config .eslintrc.json --fix \
  && DEBUG=impresso* mocha test/services/collectable-items.test.js
*/
describe('\'collectable-items\' service', function () {
  this.timeout(30000);
  const service = app.service('collectable-items');
  const user = {};
  const collection = {};

  it('registered the service', () => {
    assert.ok(service, 'Registered the service');
  });

  // it.only('get the items for a specific collection', async () => {
  //   const result = await service.find({
  //     query: {
  //       collection_uid: 'local-',
  //     },
  //     user,
  //   });
  //   console.log(result);
  // });

  it('setup the test', async () => {
    const result = await generateUser();
    assert.ok(result.uid, 'should have an uid prop');
    assert.ok(result.id, 'should have an id');
    assert.ok(result.username, 'should have a nice username');
    // enrich the user variable
    user.username = result.username;
    user.uid = result.uid;
    user.id = result.id;
  });

  it('create a collection', async () => {
    const result = await app.service('collections').create({
      name: 'a nice name',
      description: 'digitus',
    }, {
      user,
    });
    assert.ok(result.uid, 'should have an unique uid');
    collection.uid = result.uid;
  });

  it('create an entry item for the current user', async () => {
    const results = await service.create({
      collection_uid: collection.uid,
      items: [
        {
          uid: 'GDL-1967-04-25-a-i0152',
          content_type: 'article',
        },
      ],
    }, {
      authenticated: true,
      user,
    });
    assert.ok(results.data.length);
  });

  it('find all items for the current user', async () => {
    const results = await service.find({
      query: {
        limit: 2,
        resolve: 'item',
      },
      authenticated: true,
      user,
    });
    assert.equal(results.total, 1);
    assert.ok(results.data[0].collections.length, 'has at least one collection!');
    assert.equal(results.data[0].item.uid, 'GDL-1967-04-25-a-i0152', 'item has been resolved');
  });

  it('find all collectableitems for a given set of item uids', async () => {
    const results = await service.find({
      query: {
        item_uids: ['GDL-1967-04-25-a-i0152'],
      },
      authenticated: true,
      user,
    });
    assert.ok(results);
  });

  it('find all collectableitems for a given set of item uids', async () => {
    const results = await service.find({
      query: {
        collection_uids: [
          collection.uid,
        ],
        resolve: 'item',
      },
      authenticated: true,
      user,
    });

    assert.ok(results);
  });

  it('remove an article from a collection', async () => {
    const results = await service.remove(collection.uid, {
      query: {
        collection_uid: collection.uid,
        items: [
          {
            uid: 'GDL-1967-04-25-a-i0152',
          },
        ],
      },
      user,
    });
    assert.equal(results.removed, 1);
    assert.ok(results);
  });

  it('remove setup', async () => {
    await removeGeneratedUser(user);
  });
});
