import { strict as assert } from 'assert'
import { Service as UsersService } from '@/services/users/users.class.js'
import { Service as MeService } from '@/services/me/me.class.js'
import { UserEmailVerificationService } from '@/services/user-email-verification/user-email-verification.class.js'
import { setupTestApp, withConfig, withDatabase, withDebugLogging, withRedisCelery } from '../../../helpers/app.js'
import { BadRequest } from '@feathersjs/errors'

describe('UserEmailVerificationService', () => {
  let testApp: ReturnType<
    typeof setupTestApp<
      [
        ReturnType<typeof withDatabase>,
        ReturnType<typeof withDebugLogging>,
        ReturnType<typeof withRedisCelery>,
        ReturnType<typeof withConfig>,
      ]
    >
  >
  let service: UserEmailVerificationService
  let meService: MeService
  let userService: UsersService

  before(async () => {
    testApp = setupTestApp(
      withDatabase(),
      withDebugLogging(),
      withRedisCelery(),
      withConfig('magicLink', {
        secret: 'test-secret',
        expiration: 300,
      })
    )
    service = new UserEmailVerificationService(testApp.app)
    userService = new UsersService({ app: testApp.app, name: 'users' })
    meService = new MeService({ app: testApp.app, name: 'me' })

    await testApp.sequelize.sync({ force: true })
  })

  after(async () => {
    await testApp.teardown()
  })

  beforeEach(async () => {
    await testApp.sequelize.truncate({ cascade: true })
    testApp.celeryRunCalls.length = 0
    Object.keys(testApp.redisSetExCalls).forEach(key => delete testApp.redisSetExCalls[key])
  })

  describe('create', () => {
    it('should create a new user and store the user id in Redis with a key starting with "user-email-verification:"', async () => {
      const result = await userService.create({
        username: 'jdoe',
        firstname: 'Jane',
        lastname: 'Doe',
        displayName: 'Jane Doe',
        email: 'jdoe@example.com',
        password: 'secret123',
      })

      // check that the user id is stored in Redis with a key starting with "user-email-verification:"
      const verificationKey = Object.keys(testApp.redisSetExCalls).find(
        key => key.startsWith('user-email-verification:') && key.split(':').length === 2
      )
      const activeByUserKey = `user-email-verification:active-by-user:${result.id}`

      assert.ok(verificationKey)
      assert.ok(testApp.redisSetExCalls[activeByUserKey])
      assert.strictEqual(testApp.redisSetExCalls[verificationKey!].value, String(result.id))
      assert.strictEqual(testApp.redisSetExCalls[verificationKey!].expiration, 300)
      assert.strictEqual(testApp.redisSetExCalls[activeByUserKey].expiration, 300)

      const token = verificationKey!.split(':')[1]
      assert.match(token, /^[A-Za-z0-9_-]+$/)
      assert.ok(token.length >= 43)

      // check that user profile is created and emailVerified is false

      assert.ok(result.profile.uid, 'Profile uid is not set')
      assert.strictEqual(result.profile.emailVerified, false)
      // call the service with the token to check that it returns the correct user id
      const validationResult = await service.create({ token }, {})
      assert.strictEqual(validationResult.result, 'ok')
      // call the me service and check the emailVerified is now true
      const getMeResult = await meService.find({ user: { id: String(result.id), uid: result.uid } })
      assert.strictEqual(getMeResult.emailVerified, true)
    })

    it('should delete the redis token entry after successful verification', async () => {
      const result = await userService.create({
        username: 'jdoe2',
        firstname: 'Jane',
        lastname: 'Doe',
        displayName: 'Jane Doe',
        email: 'jdoe2@example.com',
        password: 'secret123',
      })

      const redisKey = Object.keys(testApp.redisSetExCalls).find(
        key => key.startsWith('user-email-verification:') && key.split(':').length === 2
      )
      const redisClient = testApp.app.service('redisClient').client as {
        get: (key: string) => Promise<string | null>
      }

      assert.ok(redisKey)
      assert.strictEqual(await redisClient.get(redisKey!), String(result.id))

      await service.create({ token: redisKey!.split(':')[1] }, {})

      assert.strictEqual(testApp.redisSetExCalls[redisKey!], undefined)
      assert.strictEqual(await redisClient.get(redisKey!), null)
      assert.strictEqual(await redisClient.get(`user-email-verification:active-by-user:${result.id}`), null)
    })

    it('should fail if the token is invalid', async () => {
      const invalidToken = 'invalid-token'
      try {
        await service.create({ token: invalidToken }, {})
        assert.fail('Expected error was not thrown')
      } catch (error) {
        // error is of type BadRequest
        assert.ok(error instanceof BadRequest)
        assert.strictEqual(error.message, 'Invalid or expired token')
      }
    })
  })
})
