const assert = require('assert');
const app = require('../../src/app');
const { generateUser, removeGeneratedUser } = require('./utils');
/*
./node_modules/.bin/eslint \
src/services/utils.js src/models src/services/articles-tags \
test/services/articles-tags.test.js --fix &&
DEBUG=impresso* mocha test/services/articles-tags.test.js

./node_modules/.bin/eslint \
src/services/utils.js src/models src/services/articles-tags \
test/services/articles-tags.test.js --fix &&
mocha test/services/articles-tags.test.js
*/
describe('\'articles-tags\' service', function () {
  this.timeout(10000);

  const service = app.service('articles-tags');
  let user = {
    username: 'guest-test-2',
    password: 'Apaaiiai87!!',
    email: 'guest-test-2@impresso-project.ch',
  };

  let tag;

  it('registered the service', () => {
    assert.ok(service, 'Registered the service');
  });

  it('setup the test', async () => {
    user = await generateUser(user);
    assert.ok(user.uid);
  });

  //
  it('attach a tag to our test article', async () => {
    const results = await service.create({
      article_uid: 'GDL-1902-05-12-a-i0012',
      tag: 'brave new world',
    }, {
      user,
    });

    tag = results.data;
    assert.equal(results.info._stats.relationshipsCreated, 2);
    assert.equal(results.data.name, 'brave new world');
    assert.ok(results.data.labels);
  });

  it('check that the tag is in the taglist', async () => {
    const resultAuth = await app.service('articles').get('GDL-1902-05-12-a-i0012', {
      user,
    });
    assert.ok(resultAuth.labels);
    // Does contain the tag
    assert.equal(resultAuth.tags[0].uid, tag.uid);

    const result = await app.service('articles').get('GDL-1902-05-12-a-i0012');
    // SHOULD not contain the tag
    assert.equal(result.tags.length, 0);
  });

  it('remove the tag attached to our beloved article', async () => {
    // console.log(tag);
    const results = await service.remove('GDL-1902-05-12-a-i0012', {
      user,
      query: {
        tag_uid: tag.uid,
      },
    });
    assert.equal(results.info._stats.relationshipsDeleted, 1);
    // console.log(results);
  });

  it('remove setup', async () => {
    await removeGeneratedUser(user);
  });
});
