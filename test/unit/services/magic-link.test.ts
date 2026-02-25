import { strict as assert } from 'assert'
import { Unavailable } from '@feathersjs/errors'
import { MagicLinkService } from '@/services/magic-link/magic-link.class.js'
import User from '@/models/users.model.js'
import type { CeleryCall, RedisSetExCall, TestDatabase } from '../../helpers/database.js'
import { setupTestDatabaseRedisCelery, teardownTestDatabase } from '../../helpers/database.js'
import type { CeleryClient } from '@/celery.js'

const mockUsers = Array.from({ length: 2 }, (_, i) => ({
  uid: `user${i + 1}`,
  id: i + 1,
  username: `local-${i + 1}`,
  firstname: `First ${i + 1}`,
  lastname: `Last ${i + 1}`,
  email: `user${i + 1}@example.com`,
  password: 'test',
  isActive: true,
}))

describe('MagicLinkService', () => {
  let db: TestDatabase
  let service: MagicLinkService
  let userModel: ReturnType<typeof User.sequelize>
  let celeryClient: CeleryClient
  const trackers = { celeryCalls: [] as CeleryCall[], redisCalls: {} as Record<string, RedisSetExCall> }

  before(async () => {
    // Setup database once for all tests
    db = setupTestDatabaseRedisCelery(trackers.celeryCalls, trackers.redisCalls)
    userModel = User.sequelize(db.sequelize)
    celeryClient = db.app.get('celeryClient') as CeleryClient

    await db.sequelize.sync({ force: true })
    service = new MagicLinkService(db.app)
  })

  after(async () => {
    await teardownTestDatabase(db)
  })

  beforeEach(async () => {
    // Clear the tables before each test
    await db.sequelize.truncate({ cascade: true })
    // Reset the celery calls tracking
    trackers.celeryCalls.length = 0
    for (const key in trackers.redisCalls) delete trackers.redisCalls[key]
  })

  describe('create', () => {
    it('should send magic link email and return ok result for valid email', async () => {
      // Create a test user
      await userModel.create(mockUsers[0] as any)

      const result = await service.create({ email: mockUsers[0].email })

      assert.ok(result)
      assert.strictEqual(result.result, 'ok')
      assert.strictEqual(trackers.celeryCalls.length, 1)

      // Verify the celery task was called with correct parameters
      const taskCall = trackers.celeryCalls[0]
      assert.strictEqual(taskCall.task, 'impresso.tasks.email_magic_link')
      assert.ok(Array.isArray(taskCall.args))
      assert.strictEqual(taskCall.args[0], mockUsers[0].id)
      assert.ok(typeof taskCall.args[1] === 'string') // token
      // callback URL
      console.log('Callback URL argument:', taskCall) // Debug log to check callback URL
      assert.ok(typeof taskCall.args[2] === 'string')
    })

    it('should still return OK when user not found, but no email sent', async () => {
      const result = await service.create({ email: 'nonexistent@example.com' })
      assert.ok(result)
      assert.strictEqual(result.result, 'ok')
      // Celery should not be called
      assert.strictEqual(trackers.celeryCalls.length, 0)
    })

    it('should throw Unavailable when celery client fails', async () => {
      // Create a test user
      await userModel.create(mockUsers[0] as any)

      // Mock failed celery task execution
      const failingCeleryClient: CeleryClient = {
        run: async () => {
          throw new Error('Celery service unavailable')
        },
      }

      // Temporarily replace the celery client
      const originalGet = db.app.get
      ;(db.app as any).get = (key: string) => {
        if (key === 'celeryClient') return failingCeleryClient
        return originalGet.call(db.app, key as any)
      }

      const failingService = new MagicLinkService(db.app)

      await assert.rejects(failingService.create({ email: mockUsers[0].email }), (error: any) => {
        assert.ok(error instanceof Unavailable)
        assert.ok(error.message.includes('Failed to send email'))
        return true
      })

      // Restore original get method
      ;(db.app as any).get = originalGet
    })

    it('should work with multiple users', async () => {
      // Create multiple test users
      await userModel.bulkCreate(mockUsers as any)

      // Send magic link to each user
      for (const user of mockUsers) {
        const result = await service.create({ email: user.email })
        assert.strictEqual(result.result, 'ok')
      }

      assert.strictEqual(trackers.celeryCalls.length, mockUsers.length)
    })

    it('should only work with active users', async () => {
      // Create an inactive user
      await userModel.create({
        ...mockUsers[0],
        isActive: false,
      } as any)
      const result = await service.create({ email: mockUsers[0].email })
      assert.ok(result)
      assert.strictEqual(result.result, 'ok')
      // Celery should not be called
      assert.strictEqual(trackers.celeryCalls.length, 0)
    })

    it('should generate a JWT token with correct claims', async () => {
      // Create a test user
      await userModel.create(mockUsers[0] as any)

      await service.create({ email: mockUsers[0].email })

      const taskCall = trackers.celeryCalls[0]
      const token = taskCall.args[1]

      // Verify token structure (JWT format: header.payload.signature)
      assert.ok(typeof token === 'string')
      const parts = token.split('.')
      assert.strictEqual(parts.length, 3, 'Token should have 3 parts (JWT format)')
    })
  })

  // describe('get', () => {
  //   it('should return a valid token in response', async () => {
  //     // Create a test user
  //     const user = await userModel.create(mockUsers[0] as any)
  //     await service.create({ email: mockUsers[0].email })

  //     const taskCall = celeryRunCalls[0]
  //     const token = taskCall.args[1]

  //     console.log(token)

  //     const result = await service.get(token)

  //     assert.ok(result)
  //   })

  //   it('should throw BadRequest error for a bad JWT', async () => {
  //     await assert.rejects(service.get('999'), (error: any) => {
  //       assert.ok(error instanceof BadRequest)
  //       assert.strictEqual(error.message, 'Invalid token format')
  //       return true
  //     })
  //   })
  //   it('should throw BadRequest error for an invalid JWT', async () => {
  //     const invalidToken = 'invalid.payload.signature'
  //     await assert.rejects(service.get(invalidToken), (error: any) => {
  //       assert.ok(error instanceof BadRequest)
  //       assert.strictEqual(error.message, 'Invalid token')
  //       return true
  //     })
  //   })
  // })
})
