const assert = require('assert');
const app = require('../../src/app');

describe('\'users\' service', () => {
  const service = app.service('users');

  it('registered the service', () => {
    assert.ok(service, 'Registered the service');
  });
  it('find users', (done) => {
    service.find({
      query:{
        email: 'thijs.vanbeek@uni.lu',
        githubId: undefined,
        uid: 'thijs.vanbeek@uni.lu',
        user_uid: undefined,
      }
    }).then(res => {
      console.log(res.data);
      assert.ok(res.data.length);
      done();
    }).catch(err => {
      console.log(err);
      done();
    });
  });
});
