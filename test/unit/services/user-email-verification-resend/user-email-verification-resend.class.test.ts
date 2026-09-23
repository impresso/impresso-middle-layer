import { strict as assert } from 'assert'
import { Service as UsersService } from '@/services/users/users.class.js'
import { UserEmailVerificationResendService } from '@/services/user-email-verification-resend/user-email-verification-resend.class.js'
import User from '@/models/users.model.js'
import { setupTestApp, withConfig, withDatabase, withRedisCelery } from '../../../helpers/app.js'

const getEmailHashKeys = (keys: string[]) =>
  keys.filter(key => key.startsWith('user-email-verification:resend-email-hash:'))

describe('UserEmailVerificationResendService', () => {
  let testApp: ReturnType<
    typeof setupTestApp<
      [ReturnType<typeof withDatabase>, ReturnType<typeof withRedisCelery>, ReturnType<typeof withConfig>]
    >
  >
  let service: UserEmailVerificationResendService
  let userService: UsersService

  before(async () => {
    testApp = setupTestApp(
      withDatabase(),
      withRedisCelery(),
      withConfig('magicLink', {
        secret: 'test-secret',
        expiration: 300,
      })
    )

    service = new UserEmailVerificationResendService(testApp.app)
    userService = new UsersService({ app: testApp.app, name: 'users' })

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

  it('returns ok for unknown email without side effects', async () => {
    const result = await service.create({ email: 'missing@example.org' })

    assert.deepStrictEqual(result, { result: 'ok' })
    assert.strictEqual(testApp.celeryRunCalls.length, 0)
    const allKeys = Object.keys(testApp.redisSetExCalls)
    const emailHashKeys = getEmailHashKeys(allKeys)
    assert.strictEqual(emailHashKeys.length, 1)
    assert.strictEqual(testApp.redisSetExCalls[emailHashKeys[0]].expiration, 3600)
  })

  it('returns ok for active users without side effects', async () => {
    const created = await userService.create({
      username: 'active-user',
      firstname: 'Active',
      lastname: 'User',
      displayName: 'Active User',
      email: 'active@example.org',
      password: 'Secret123!',
    })

    await User.sequelize(testApp.sequelize).update(
      { isActive: true },
      {
        where: { id: created.id },
      }
    )

    testApp.celeryRunCalls.length = 0
    Object.keys(testApp.redisSetExCalls).forEach(key => delete testApp.redisSetExCalls[key])

    const result = await service.create({ email: 'active@example.org' })

    assert.deepStrictEqual(result, { result: 'ok' })
    assert.strictEqual(testApp.celeryRunCalls.length, 0)
    const allKeys = Object.keys(testApp.redisSetExCalls)
    const emailHashKeys = getEmailHashKeys(allKeys)
    assert.strictEqual(emailHashKeys.length, 1)
    assert.strictEqual(testApp.redisSetExCalls[emailHashKeys[0]].expiration, 3600)
  })

  it('blocks resend when email-hash limit is reached', async () => {
    const email = 'hash-limit@example.org'
    const redisClient = testApp.app.service('redisClient').client as {
      get: (key: string) => Promise<string | null>
    }

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const result = await service.create({ email })
      assert.strictEqual(result.result, 'ok')
    }

    const waitResult = await service.create({ email })
    assert.strictEqual(waitResult.result, 'wait')
    assert.strictEqual(waitResult.retryAfterSeconds, 3600)

    const hashKey = Object.keys(testApp.redisSetExCalls).find(key =>
      key.startsWith('user-email-verification:resend-email-hash:')
    )
    assert.ok(hashKey)
    assert.strictEqual(await redisClient.get(hashKey!), '5')
  })

  it('blocks resend while an active verification token exists', async () => {
    const created = await userService.create({
      username: 'pending-user',
      firstname: 'Pending',
      lastname: 'User',
      displayName: 'Pending User',
      email: 'pending@example.org',
      password: 'Secret123!',
    })

    testApp.celeryRunCalls.length = 0

    const result = await service.create({ email: 'pending@example.org' })

    assert.strictEqual(result.result, 'wait')
    assert.strictEqual(result.retryAfterSeconds, 300)
    assert.strictEqual(testApp.celeryRunCalls.length, 0)

    const activeKey = `user-email-verification:active-by-user:${created.id}`
    assert.ok(testApp.redisSetExCalls[activeKey])
  })

  it('blocks resend when daily limit is reached', async () => {
    const created = await userService.create({
      username: 'daily-limit-user',
      firstname: 'Daily',
      lastname: 'Limit',
      displayName: 'Daily Limit',
      email: 'daily@example.org',
      password: 'Secret123!',
    })

    Object.keys(testApp.redisSetExCalls).forEach(key => delete testApp.redisSetExCalls[key])
    testApp.celeryRunCalls.length = 0

    const redisClient = testApp.app.service('redisClient').client as {
      setEx: (key: string, expiration: number, value: string) => Promise<string>
    }

    await redisClient.setEx(`user-email-verification:resend-daily:${created.id}`, 86400, '3')

    const result = await service.create({ email: 'daily@example.org' })

    assert.strictEqual(result.result, 'wait')
    assert.strictEqual(result.retryAfterSeconds, 86400)
    assert.strictEqual(testApp.celeryRunCalls.length, 0)
  })

  it('resends verification for eligible inactive users and sets all throttle keys', async () => {
    const created = await userService.create({
      username: 'resend-user',
      firstname: 'Resend',
      lastname: 'User',
      displayName: 'Resend User',
      email: 'resend@example.org',
      password: 'Secret123!',
    })

    Object.keys(testApp.redisSetExCalls).forEach(key => delete testApp.redisSetExCalls[key])
    testApp.celeryRunCalls.length = 0

    const result = await service.create({ email: 'resend@example.org' })

    assert.deepStrictEqual(result, { result: 'ok' })
    assert.strictEqual(testApp.celeryRunCalls.length, 1)
    assert.strictEqual(testApp.celeryRunCalls[0].task, 'impresso.tasks.resend_user_email_verification')
    assert.strictEqual(testApp.celeryRunCalls[0].args[0], created.id)
    assert.strictEqual(typeof testApp.celeryRunCalls[0].args[1], 'string')

    const activeByUserKey = `user-email-verification:active-by-user:${created.id}`
    const cooldownKey = `user-email-verification:resend-cooldown:${created.id}`
    const dailyKey = `user-email-verification:resend-daily:${created.id}`
    const emailHashKey = Object.keys(testApp.redisSetExCalls).find(key =>
      key.startsWith('user-email-verification:resend-email-hash:')
    )

    assert.ok(testApp.redisSetExCalls[activeByUserKey])
    assert.strictEqual(testApp.redisSetExCalls[activeByUserKey].expiration, 300)
    assert.ok(testApp.redisSetExCalls[cooldownKey])
    assert.strictEqual(testApp.redisSetExCalls[cooldownKey].expiration, 900)
    assert.ok(testApp.redisSetExCalls[dailyKey])
    assert.strictEqual(testApp.redisSetExCalls[dailyKey].expiration, 86400)
    assert.strictEqual(testApp.redisSetExCalls[dailyKey].value, '1')
    assert.ok(emailHashKey)
    assert.strictEqual(testApp.redisSetExCalls[emailHashKey!].expiration, 3600)
    assert.strictEqual(testApp.redisSetExCalls[emailHashKey!].value, '1')

    const verificationKey = Object.keys(testApp.redisSetExCalls).find(
      key => key.startsWith('user-email-verification:') && key.split(':').length === 2
    )
    assert.ok(verificationKey)
    assert.strictEqual(testApp.redisSetExCalls[verificationKey!].value, String(created.id))
  })
})
