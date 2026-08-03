import { strict as assert } from 'assert'
import { Service as UsersService } from '@/services/users/users.class.js'
import User from '@/models/users.model.js'
import { setupTestApp, withDatabase, withDebugLogging, withRedisCelery } from '../../../helpers/app.js'

describe('UsersService', () => {
  let testApp: ReturnType<
    typeof setupTestApp<
      [ReturnType<typeof withDatabase>, ReturnType<typeof withDebugLogging>, ReturnType<typeof withRedisCelery>]
    >
  >
  let service: UsersService

  before(async () => {
    testApp = setupTestApp(withDatabase(), withDebugLogging(), withRedisCelery())
    service = new UsersService({ app: testApp.app, name: 'users' })
    await testApp.sequelize.sync({ force: true })
  })

  after(async () => {
    await testApp.teardown()
  })

  beforeEach(async () => {
    await testApp.sequelize.truncate({ cascade: true })
    testApp.celeryRunCalls.length = 0
  })

  describe('create', () => {
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
      assert.deepStrictEqual(testApp.celeryRunCalls[0].args, [result.id])
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
      assert.deepStrictEqual(testApp.celeryRunCalls[0].args, [result.id])
    })
  })
})
