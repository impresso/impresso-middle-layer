const assert = require('assert');
const app = require('../../src/app');
const { generateUser, removeGeneratedUser } = require('./utils');

/*
 ./node_modules/.bin/eslint  \
 src/services/collection src/models/collections.model.js --fix \
 && DEBUG=impresso* mocha test/services/collections.test.js
*/
const user = {
  username: 'local-user-test-only',
  password: 'Impresso2018!',
  email: 'local-user-test-only@impresso-project.ch',
};

const collection = {
  uid: 'this-is-random-collection-id',
  name: 'a nice name',
  description: 'digitus',
};

describe('\'collections\' service', function () {
  this.timeout(15000);
  const service = app.service('collections');

  it('registered the service', () => {
    assert.ok(service, 'Registered the service');
  });

  it('setup the test', async () => {
    const result = await generateUser(user);
    assert.ok(result.uid, 'should have an uid prop');
    assert.ok(result.id, 'should have an id');
    assert.equal(result.username, user.username);
    // enrich the user variable
    user.uid = result.uid;
    user.id = result.id;
  });

  it('registered the service', () => {
    assert.ok(service, 'Registered the service');
  });

  it('create a collection', async () => {
    console.log('create a collection', user);
    const result = await service.create(collection, {
      user,
    });
    console.log(result);
  });

  // it('get a collection', async () => {
  //   const result = await service.get(collection.uid, {
  //     user,
  //   });
  //
  //   console.log(result);
  // });
  //
  // it('find all collections for one user, filter by q', async () => {
  //   const result = await service.find({
  //     user,
  //     query: {
  //       q: 'Accent other',
  //     }
  //   });
  //
  //   console.log(result);
  // });

  it('remove setup', async () => {
    await removeGeneratedUser(user);
  });
});
