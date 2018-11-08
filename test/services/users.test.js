const assert = require('assert');
const app = require('../../src/app');

/**
 * use with
  ./node_modules/.bin/eslint test/services/users.test.js  \
  src/services/users src/hooks --fix \
  && DEBUG=impresso/* mocha test/services/users.test.js
 */
describe('\'users\' service', function () {
  const service = app.service('users');
  this.timeout(5000);

  it('registered the service', () => {
    assert.ok(service, 'Registered the service');
  });

  const user = {
    username: 'guest-test-2',
    password: 'impresso',
    email: 'guest-test-2@impresso-project.ch',
  };

  it('remove then create the user', async () => {
    const removed = await service.remove(user.username, {
      user: {
        is_staff: true,
      },
    });
    assert.ok(removed.info._stats);

    const created = await service.create({
      username: 'guest-test-2',
      password: 'Apitchapong!87',
      email: 'guest-test-2@impresso-project.ch',
    });
    assert.ok(created);
  });

  it('change password', async () => {
    const result = await service.patch(user.username, {
      password: 'Apitchapong!84',
    }, {
      user: {
        is_staff: true,
      },
    });
    assert.ok(result);
  });

  it('find user guest-test-2', async () => {
    const users = await service.find({
      query: {
        email: user.email,
        githubId: undefined,
        user_uid: undefined,
      },
    });
    // should be an empty array. No errors
    assert.equal(users.length, 1);
  });

  it('find users', async () => {
    const users = await service.find({
      query: {
        email: 'email@not.found',
        githubId: undefined,
        user_uid: undefined,
      },
    });
    // should be an empty array. No errors
    assert.equal(users.length, 0);
  });
});
