const assert = require('assert');
const app = require('../../src/app');

describe('\'users\' service', () => {
  const service = app.service('users');

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
  // it('find users', async () => {
  //   const users = await service.find({
  //     query: {
  //       email: 'email@not.found',
  //       githubId: undefined,
  //       user_uid: undefined,
  //     },
  //   });
  //   // should be an empty array. No errors
  //   assert.equal(users.length, 0);
  // });
});
