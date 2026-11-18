import { strict as assert } from 'assert'
import { NotAuthenticated, Forbidden } from '@feathersjs/errors'
import { AuthenticationService } from '@feathersjs/authentication'
import { feathers } from '@feathersjs/feathers'
import jwt from 'jsonwebtoken'
import User from '@/models/users.model.js'
import {
  ACCOUNT_PENDING_ACTIVATION,
  AccountPendingActivationError,
  HashedPasswordVerifier,
  MagicLinkJWTStrategy,
} from '@/authentication.js'
import type { TestDatabase, RedisSetExCall } from '../helpers/database.js'
import { setupTestDatabase, setupTestDatabaseRedisCelery, teardownTestDatabase } from '../helpers/database.js'

const mockUser = ({ isActive = true }: { isActive?: boolean } = {}) => ({
  uid: `local-${isActive ? 'active' : 'inactive'}`,
  id: 1,
  username: 'local-1',
  firstname: 'First',
  lastname: 'Last',
  email: 'user1@example.com',
  password: User.buildPassword({ password: 'test-password' }),
  isActive,
})

describe('authentication strategies', () => {
  describe('HashedPasswordVerifier (local strategy)', () => {
    let db: TestDatabase
    let verifier: HashedPasswordVerifier
    let userModel: ReturnType<typeof User.sequelize>

    before(async () => {
      db = setupTestDatabase()
      userModel = User.sequelize(db.sequelize)
      await db.sequelize.sync({ force: true })
      verifier = new HashedPasswordVerifier(db.app)
    })

    after(async () => {
      await teardownTestDatabase(db)
    })

    beforeEach(async () => {
      await db.sequelize.truncate({ cascade: true })
    })

    describe('findEntity', () => {
      it('should find an active user by email', async () => {
        await userModel.create(mockUser() as never)

        const user = await verifier.findEntity('user1@example.com', {})

        assert.ok(user instanceof User)
        assert.strictEqual(user.id, 1)
      })

      it('should find an inactive user too (no isActive scope)', async () => {
        await userModel.create(mockUser({ isActive: false }) as never)

        const user = await verifier.findEntity('user1@example.com', {})

        assert.ok(user instanceof User)
        assert.strictEqual(user.id, 1)
        assert.strictEqual(user.isActive, false)
      })

      it('should throw NotAuthenticated for nonexistent users', async () => {
        await assert.rejects(verifier.findEntity('nonexistent@example.com', {}), (error: unknown) => {
          assert.ok(error instanceof NotAuthenticated)
          return true
        })
      })

      it('should throw NotAuthenticated when no username is given', async () => {
        await assert.rejects(verifier.findEntity('', {}), (error: unknown) => {
          assert.ok(error instanceof NotAuthenticated)
          return true
        })
      })
    })

    describe('comparePassword', () => {
      it('should accept valid credentials for an active user', async () => {
        await userModel.create(mockUser() as never)
        const user = await verifier.findEntity('user1@example.com', {})

        const result = await verifier.comparePassword(user, 'test-password')

        assert.strictEqual(result.id, 1)
        // lastLogin has been updated
        const updated = await userModel.findByPk(1)
        assert.ok(updated)
        assert.ok(updated.get('lastLogin') != null)
      })

      it('should throw Forbidden with ACCOUNT_PENDING_ACTIVATION for an inactive user with valid credentials', async () => {
        await userModel.create(mockUser({ isActive: false }) as never)
        const user = await verifier.findEntity('user1@example.com', {})

        await assert.rejects(verifier.comparePassword(user, 'test-password'), (error: unknown) => {
          assert.ok(error instanceof Forbidden)
          assert.ok(error instanceof AccountPendingActivationError)
          assert.deepStrictEqual((error as Forbidden).data?.code, ACCOUNT_PENDING_ACTIVATION)
          return true
        })

        // lastLogin must NOT be updated
        const updated = await userModel.findByPk(1)
        assert.ok(updated)
        assert.strictEqual(updated.get('lastLogin'), null)
      })

      it('should throw NotAuthenticated (not Forbidden) for an inactive user with wrong password', async () => {
        await userModel.create(mockUser({ isActive: false }) as never)
        const user = await verifier.findEntity('user1@example.com', {})

        await assert.rejects(verifier.comparePassword(user, 'wrong-password'), (error: unknown) => {
          assert.ok(error instanceof NotAuthenticated)
          return true
        })
      })

      it('should throw NotAuthenticated for an active user with wrong password', async () => {
        await userModel.create(mockUser() as never)
        const user = await verifier.findEntity('user1@example.com', {})

        await assert.rejects(verifier.comparePassword(user, 'wrong-password'), (error: unknown) => {
          assert.ok(error instanceof NotAuthenticated)
          return true
        })
      })
    })
  })

  describe('MagicLinkJWTStrategy', () => {
    let db: TestDatabase
    let authService: AuthenticationService
    let userModel: ReturnType<typeof User.sequelize>
    const redisStore: Record<string, RedisSetExCall> = {}

    before(async () => {
      db = setupTestDatabaseRedisCelery([], redisStore)
      userModel = User.sequelize(db.sequelize)
      await db.sequelize.sync({ force: true })

      // AuthenticationService requires a real Feathers application instance.
      // Reuse the mocked configuration and redis client from the test db app.
      const authenticationConfig = {
        secret: 'test-secret-key',
        service: 'users',
        entity: 'user',
        authStrategies: ['magic-link'],
      }
      const authApp = feathers() as unknown as typeof db.app
      ;(authApp as unknown as { get: (key: string) => unknown }).get = (key: string) =>
        key === 'authentication'
          ? authenticationConfig
          : (db.app as unknown as { get: (key: string) => unknown }).get(key)
      ;(authApp as unknown as { service: (name: string) => unknown }).service = (name: string) => {
        if (name === 'redisClient') {
          return (db.app as unknown as { service: (name: string) => unknown }).service(name)
        }
        if (name === 'users') {
          return {
            get: async (id: string) => ({ id: Number(id) }),
          }
        }
        throw new Error(`Unexpected service call in test: ${name}`)
      }

      authService = new AuthenticationService(authApp, 'authentication', authenticationConfig)
      authService.register('magic-link', new MagicLinkJWTStrategy(authApp))
    })

    after(async () => {
      await teardownTestDatabase(db)
    })

    beforeEach(async () => {
      await db.sequelize.truncate({ cascade: true })
      for (const key of Object.keys(redisStore)) delete redisStore[key]
    })

    const createMagicLinkToken = async (userId: number) => {
      const token = jwt.sign({ rand: userId }, 'test-magic-link-secret', { expiresIn: 300 })
      const redisClient = (db.app.service('redisClient') as { client: { setEx: Function } }).client
      await redisClient.setEx(`magic-link:${token}`, 300, String(userId))
      return token
    }

    const authenticate = (token: string) =>
      authService.authenticate({ strategy: 'magic-link', accessToken: token }, {}, 'magic-link')

    it('should authenticate an active user with a valid token', async () => {
      await userModel.create(mockUser() as never)
      const token = await createMagicLinkToken(1)

      const result = (await authenticate(token)) as { user?: { id: number } }

      assert.ok(result.user)
      assert.strictEqual(result.user.id, 1)
      // one-time token: consumed
      assert.strictEqual(redisStore[`magic-link:${token}`], undefined)
    })

    it('should throw Forbidden with ACCOUNT_PENDING_ACTIVATION for an inactive user with a valid token', async () => {
      await userModel.create(mockUser({ isActive: false }) as never)
      const token = await createMagicLinkToken(1)

      await assert.rejects(authenticate(token), (error: unknown) => {
        assert.ok(error instanceof Forbidden)
        assert.ok(error instanceof AccountPendingActivationError)
        assert.deepStrictEqual((error as Forbidden).data?.code, ACCOUNT_PENDING_ACTIVATION)
        return true
      })

      // one-time token: consumed even though login was refused
      assert.strictEqual(redisStore[`magic-link:${token}`], undefined)
    })

    it('should throw NotAuthenticated when the user does not exist', async () => {
      const token = await createMagicLinkToken(42)

      await assert.rejects(authenticate(token), (error: unknown) => {
        assert.ok(error instanceof NotAuthenticated)
        return true
      })
    })
  })
})
