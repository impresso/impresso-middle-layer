import assert from 'assert'
import app from '../../../src/app'
import User from '../../../src/models/users.model'
/**
 * use with
  ./node_modules/.bin/eslint test/integration/services/users.test.js  \
  src/models/users.model.js  \
  src/models/profiles.model.js  \
  src/services/users src/hooks --fix \
  && DEBUG=impresso/* mocha test/services/users.test.js
 */
describe("'users' service", function () {
  this.timeout(10000)

  let service

  before(() => {
    service = app.service('users')
  })

  it('registered the service', () => {
    assert.ok(service, 'Registered the service')
  })

  const user = {
    username: 'local-user-test-only',
    firstname: 'test',
    lastname: 'TEST',
    displayName: 'local-user-test-only',
    password: 'Impresso2018!',
    email: 'local-user-test-only@impresso-project.ch',
  }
  before(async () => {
    await service.remove(user.username, {
      user: {
        is_staff: true,
      },
    })
  })
  //
  it('encrypt password as django does by default', async () => {
    const result = User.encryptPassword({
      salt: 'tdhWFyUPmubt',
      password: user.password,
      iterations: 10,
    })
    assert.equal('HEq5bZCHEHRBX6UoBmSdye/UMdEyoS4QeQwKIbZQdSo=', result.password)
  })

  it('compare password with django ones', async () => {
    const result = User.comparePassword({
      encrypted: 'pbkdf2_sha256$120000$tdhWFyUPmubt$dxdsTpCg+uC0lStatlWdn/NyeQb0ogwfNRqbqxexxCQ=',
      password: user.password,
    })
    assert.ok(result)
  })

  it('create the user', async () => {
    const created = await service.create(user, {
      user: {
        is_staff: true,
      },
    })
    assert.ok(created instanceof User)
    assert.deepEqual(user.displayName, created.profile.displayName)
    assert.deepEqual(user.email, created.email)
    assert.ok(created.isActive)
  })

  it('get user', async () => {
    const result = await service.get(user.username)
    assert.ok(result.uid)
    assert.ok(result.id)
  })

  // it('change password', async () => {
  //   const result = await service.patch(user.username, {
  //     password: 'Apitchapong!84',
  //   }, {
  //     user: {
  //       is_staff: true,
  //     },
  //   });
  //   assert.ok(result);
  // });

  it(`find user ${user.username}`, async () => {
    const users = await service.find({
      query: {
        email: user.email,
        githubId: undefined,
        user_uid: undefined,
      },
    })
    // should be an empty array. No errors
    assert.equal(users.length, 1)
  })

  it('find users', async () => {
    const users = await service.find({
      query: {
        email: 'email@not.found',
        githubId: undefined,
        user_uid: undefined,
      },
    })
    // should be an empty array. No errors
    assert.equal(users.length, 0)
  })
})

describe('test Service method to get users representations', () => {
  if (!process.env.USER_ID) {
    console.log(
      'No user id provided in ENV variable, skipping this test. Please make sure you provide the identifier with USER_ID:'
    )
    assert.ok(true)
    return
  }

  it('if USER_ID is set, try to get() the representation according to the config used', async () => {
    const service = app.service('users')
    const user = await service.get(process.env.USER_ID)
    assert.ok(user, 'User not found')
    console.log('User found:', user.username, 'with groups:', user.groups)
    // it should have groups
    assert.ok(user.groups, 'User has no groups')
    // it hsould have a bitmap
    assert.ok(user.bitmap, 'User has no bitmap')
  })
  it('should return a list of users', async () => {
    const service = app.service('users')
    const users = await service.find()
    assert.ok(users, 'Users not found')
    console.log('Users found:', users.length)
  })
  after(() => {
    console.log('Test finished')
  })
})
