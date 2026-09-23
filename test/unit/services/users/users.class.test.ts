import { strict as assert } from 'assert'
import { Service as UsersService } from '@/services/users/users.class.js'
import User from '@/models/users.model.js'
import { setupTestApp, withConfig, withDatabase, withRedisCelery } from '../../../helpers/app.js'
import { CallbackUrlsConfig, Config } from '@/models/generated/app/configuration.js'

describe('UsersService', () => {
  let testApp: ReturnType<
    typeof setupTestApp<
      [ReturnType<typeof withDatabase>, ReturnType<typeof withRedisCelery>, ReturnType<typeof withConfig>]
    >
  >
  let service: UsersService

  before(async () => {
    testApp = setupTestApp(
      withDatabase(),
      withRedisCelery(),
      withConfig<Config['magicLink']>('magicLink', {
        secret: 'test-secret',
        expiration: 300,
      }),
      withConfig<CallbackUrlsConfig>('callbackUrls', {
        emailVerification: 'http://localhost:5173/magic-link',
      })
    )
    service = new UsersService({ app: testApp.app, name: 'users' })
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
    it('should check that emailVerification callback is correctly configured', async () => {
      const callbackUrls = testApp.app.get('callbackUrls') as CallbackUrlsConfig
      assert.ok(callbackUrls.emailVerification, 'emailVerification callback URL is not configured')
    })
    it('should create a new user with a profile and the default group', async () => {
      const result = await service.create({
        username: 'jdoe',
        firstname: 'Jane',
        lastname: 'Doe',
        displayName: 'Jane Doe',
        email: 'jdoe@example.com',
        password: 'secret123',
      })

      assert.ok(result instanceof User)
      assert.strictEqual(result.username, 'jdoe')
      assert.strictEqual(result.email, 'jdoe@example.com')
      assert.ok(result.password.startsWith('pbkdf2_sha256$'))
      assert.strictEqual(result.profile.displayName, 'Jane Doe')
      assert.strictEqual(result.groups.length, 1)
      assert.strictEqual(result.groups[0].name, 'plan-basic')

      const persisted = await service.sequelizeKlass.findOne({ where: { username: 'jdoe' } })
      assert.ok(persisted)
      assert.strictEqual(persisted!.get('email'), 'jdoe@example.com')

      assert.strictEqual(testApp.celeryRunCalls.length, 1)
      assert.strictEqual(testApp.celeryRunCalls[0].task, 'impresso.tasks.after_user_registered')
      assert.strictEqual(testApp.celeryRunCalls[0].args[0], result.id)
      assert.strictEqual(typeof testApp.celeryRunCalls[0].args[1], 'string')
      assert.strictEqual(testApp.celeryRunCalls[0].args[2], 'http://localhost:5173/magic-link')

      const verificationKey = Object.keys(testApp.redisSetExCalls).find(
        key => key.startsWith('user-email-verification:') && key.split(':').length === 2
      )
      const activeKey = `user-email-verification:active-by-user:${result.id}`

      assert.ok(verificationKey)
      assert.ok(testApp.redisSetExCalls[activeKey])
      assert.strictEqual(testApp.redisSetExCalls[verificationKey!].value, String(result.id))
      assert.strictEqual(testApp.redisSetExCalls[verificationKey!].expiration, 300)
      assert.strictEqual(testApp.redisSetExCalls[activeKey].expiration, 300)

      const token = verificationKey!.replace('user-email-verification:', '')
      assert.match(token, /^[A-Za-z0-9_-]+$/)
      assert.ok(token.length >= 43)
    })

    it('should create a new user assigned to a custom plan group', async () => {
      const result = await service.create({
        username: 'asmith',
        firstname: 'Alan',
        lastname: 'Smith',
        displayName: 'Alan Smith',
        email: 'asmith@example.com',
        password: 'secret123',
        plan: 'plan-academic',
      })

      assert.ok(result instanceof User)
      assert.strictEqual(result.username, 'asmith')
      assert.strictEqual(result.email, 'asmith@example.com')
      assert.strictEqual(result.profile.displayName, 'Alan Smith')
      assert.strictEqual(result.groups.length, 1)
      assert.strictEqual(result.groups[0].name, 'plan-academic')

      const persisted = await service.sequelizeKlass.findOne({ where: { username: 'asmith' } })
      assert.ok(persisted)
      assert.strictEqual(persisted!.get('email'), 'asmith@example.com')

      assert.strictEqual(testApp.celeryRunCalls.length, 1)
      assert.strictEqual(testApp.celeryRunCalls[0].task, 'impresso.tasks.after_user_registered')
      assert.strictEqual(testApp.celeryRunCalls[0].args[0], result.id)
      assert.strictEqual(typeof testApp.celeryRunCalls[0].args[1], 'string')
      assert.strictEqual(testApp.celeryRunCalls[0].args[2], 'http://localhost:5173/magic-link')

      const verificationKey = Object.keys(testApp.redisSetExCalls).find(
        key => key.startsWith('user-email-verification:') && key.split(':').length === 2
      )
      const activeKey = `user-email-verification:active-by-user:${result.id}`

      assert.ok(verificationKey)
      assert.ok(testApp.redisSetExCalls[activeKey])
      assert.strictEqual(testApp.redisSetExCalls[verificationKey!].value, String(result.id))
      assert.strictEqual(testApp.redisSetExCalls[verificationKey!].expiration, 300)

      const token = verificationKey!.replace('user-email-verification:', '')
      assert.match(token, /^[A-Za-z0-9_-]+$/)
      assert.ok(token.length >= 43)
    })
  })
})
