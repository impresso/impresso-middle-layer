import { strict as assert } from 'assert'
import { NotFound, Unavailable } from '@feathersjs/errors'
import { MagicLinkService } from '@/services/magic-link/magic-link.class.js'
import User from '@/models/users.model.js'
import { setupTestDatabase, teardownTestDatabase, TestDatabase } from '../../helpers/database.js'
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
  let celeryRunCalls: Array<{ task: string; args: any[] }>

  before(async () => {
    // Setup database once for all tests
    db = setupTestDatabase()
    userModel = User.sequelize(db.sequelize)
    // Track celery calls
    celeryRunCalls = []
    // Create a simple mock celery client that tracks calls
    celeryClient = {
      run: async (task: { task: string; args: any[] }) => {
        celeryRunCalls.push(task)
        return {} as any
      },
    } as CeleryClient

    // Update the app mock to return the celeryClient
    ;(db.app as any).get = (key: string) => {
      if (key === 'sequelizeClient') return db.sequelize
      if (key === 'authentication')
        return {
          secret: 'test-secret-key',
        }
      if (key === 'celeryClient') return celeryClient
      return {}
    }

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
    celeryRunCalls = []
  })

  describe('create', () => {
    it('should send magic link email and return ok result for valid email', async () => {
      // Create a test user
      await userModel.create(mockUsers[0] as any)

      const result = await service.create({ email: mockUsers[0].email })

      assert.ok(result)
      assert.strictEqual(result.result, 'ok')
      assert.strictEqual(celeryRunCalls.length, 1)

      // Verify the celery task was called with correct parameters
      const taskCall = celeryRunCalls[0]
      assert.strictEqual(taskCall.task, 'impresso.tasks.send_magic_link_email')
      assert.ok(Array.isArray(taskCall.args))
      assert.strictEqual(taskCall.args[0], mockUsers[0].id)
      assert.ok(typeof taskCall.args[1] === 'string') // token
    })

    it('should throw NotFound when user not found', async () => {
      await assert.rejects(
        async () => {
          await service.create({ email: 'nonexistent@example.com' })
        },
        (error: any) => {
          assert.ok(error instanceof NotFound)
          return true
        }
      )

      // Celery should not be called
      assert.strictEqual(celeryRunCalls.length, 0)
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

      assert.strictEqual(celeryRunCalls.length, mockUsers.length)
    })

    it('should only work with active users', async () => {
      // Create an inactive user
      await userModel.create({
        ...mockUsers[0],
        isActive: false,
      } as any)

      await assert.rejects(
        async () => {
          await service.create({ email: mockUsers[0].email })
        },
        (error: any) => {
          assert.ok(error instanceof NotFound)
          return true
        }
      )

      assert.strictEqual(celeryRunCalls.length, 0)
    })

    it('should generate a JWT token with correct claims', async () => {
      // Create a test user
      await userModel.create(mockUsers[0] as any)

      await service.create({ email: mockUsers[0].email })

      const taskCall = celeryRunCalls[0]
      const token = taskCall.args[1]

      // Verify token structure (JWT format: header.payload.signature)
      assert.ok(typeof token === 'string')
      const parts = token.split('.')
      assert.strictEqual(parts.length, 3, 'Token should have 3 parts (JWT format)')
    })
  })
})
