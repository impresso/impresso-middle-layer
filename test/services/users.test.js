const assert = require('assert');
const app = require('../../src/app');

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

  assert.ok(user);
  // it('create a nice user', async () => {
  //   const result = await service.create({
  //     username: 'guest-test-2',
  //     password: 'Apitchapong!87',
  //     email: 'guest-test-2@impresso-project.ch',
  //   });
  //   console.log(result);
  //   assert.ok(result);
  // });
  //
  // it('delete the randomly created users and its bucket', async() => {
  //
  // })
  //
  // it('registered the service', () => {
  //   assert.ok(service, 'Registered the service');
  // });
  // it('create a nice user', async () => {
  //   const result = await service.create({
  //     username: 'guest-test',
  //     password: 'Apitchapong!87',
  //     email: 'guest-test@impresso-project.ch',
  //   });
  //   console.log(result);
  //   assert.ok(result);
  // });
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
