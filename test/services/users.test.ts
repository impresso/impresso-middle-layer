// For more information about this file see https://dove.feathersjs.com/guides/cli/service.test.html
import assert from 'assert'
const app = require('../../src/app')

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
    process.exit(0)
  })
})
