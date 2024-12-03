// For more information about this file see https://dove.feathersjs.com/guides/cli/service.test.html
import assert from 'assert'
const app = require('../../src/app')

describe('test Service method to list all my requests', () => {
  if (!process.env.USER_ID) {
    console.log(
      __filename,
      'requires a USER_ID to be set in the environment variables. Please provide the identifier with USER_ID:',
      '\n  USER_ID=1 npm run mocha test/services/user-requests.test.ts'
    )
  }

  it('registered the service', () => {
    const service = app.service('user-requests')
    assert.ok(service, 'Registered the service')
  })
  after(() => {
    console.log('\n\n  Test finished.\n')
  })

  it('get the requests from a specific user, correctly', async () => {
    const service = app.service('user-requests')
    const userRequests = await service.find({
      user: {
        id: process.env.USER_ID,
      },
      query: {
        limit: 5,
        offset: 0,
      },
    })
    console.log('d:', userRequests.data[0])
    console.log('changelog:', userRequests.data[0].changelog)
    console.log('subscription:', userRequests.data[0].subscription)
    assert.ok(userRequests.data.length, 'not engough data')
  })
  // it('if USER_ID is set, we should get the representation according to the config used', async () => {
  //   const service = app.service('user-requests')
  //   await service.find({
  //   }, params);
  //   } process.env.USER_ID)
  //   assert.ok(user, 'User not found')
  //   console.log('User found:', user.username)
  // })
  // it('should return a list of users', async () => {
  //   const service = app.service('users')
  //   const users = await service.find()
  //   assert.ok(users, 'Users not found')
  //   console.log('Users found:', users.length)
  // })
})
