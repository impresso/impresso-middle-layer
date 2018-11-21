const assert = require('assert');
const app = require('../../src/app');
const { generateUser, removeGeneratedUser } = require('./utils');

/*

./node_modules/.bin/eslint \
test/services/pages.test.js src/services/pages --fix \
&& DEBUG=impresso* mocha test/services/pages.test.js

*/
describe('\'pages\' service', function () {
  this.timeout(10000);
  const service = app.service('pages');

  let user = {
    username: 'guest-test-2',
    password: 'Apaaiiai87!!',
    email: 'guest-test-2@impresso-project.ch',
  };


  it('registered the service', () => {
    assert.ok(service, 'Registered the service');
  });

  it('setup the test', async () => {
    user = await generateUser(user);
    assert.ok(user.uid);
  });

  it('get complete page item', async () => {
    const pag = await service.get('GDL-1902-05-12-a-p0002');

    console.log(pag);
    assert.ok(pag.labels, 'has label');
    assert.ok(pag.iiif, 'has iiif proxied');
    // assert.ok(pag.labbellos, 'has label');
  });

  it('if there\'s an user_uid, get the buckets associate to the page', async () => {
    const pag = await service.get('GDL-1882-06-01-a-p0002', {
      user: {
        uid: 'local-user-test-only',
      },
    });

    // console.log(pag);
    assert.ok(pag.labels, 'has label');
    assert.ok(pag.iiif, 'has iiif proxied');
    // assert.ok(pag.labbellos, 'has label');
  });

  it('remove setup', async () => {
    await removeGeneratedUser(user);
  });
});
