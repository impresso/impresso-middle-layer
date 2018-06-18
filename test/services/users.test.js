const assert = require('assert');
const app = require('../../src/app');

describe('\'users\' service', () => {
  const service = app.service('users');

  it('registered the service', () => {
    assert.ok(service, 'Registered the service');
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
