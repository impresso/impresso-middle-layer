import { Sequelize } from 'sequelize'
import { ImpressoApplication } from '@/types.js'
import { CeleryClient } from '@/celery.js'
import { RedisClient } from '@/redis.js'

export interface TestDatabase {
  sequelize: Sequelize
  app: ImpressoApplication
}

export type CeleryCall = {
  task: string
  args: any[]
}

export type RedisSetExCall = {
  key: string
  expiration: number
  value: string
}
/**
 * Creates an in-memory SQLite database for testing
 */
export function setupTestDatabase(options?: { logging?: boolean | ((sql: string) => void) }): TestDatabase {
  const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: ':memory:',
    logging: options?.logging ?? false,
    define: {
      timestamps: false,
    },
  })
  // Mock Feathers app
  const app = {
    get: (key: string) => (key === 'sequelizeClient' ? sequelize : undefined),
  } as ImpressoApplication

  return {
    sequelize,
    app,
  }
}

/**
 * Creates an in-memory SQLite database for testing and mocks Celery and Redis clients.
 * The provided `celeryRunCalls` and `redisSetExCalls` objects will be populated with calls made to the mocked clients, allowing tests to assert on these interactions.
 * @param options Optional Sequelize configuration (e.g., logging)
 * @param celeryRunCalls An array that will be populated with calls to the mocked Celery client's `run` method
 * @param redisSetExCalls An object that will be populated with calls to the mocked Redis client's `setEx` method, keyed by Redis key
 * @returns A TestDatabase instance with the Sequelize connection and a mocked Feathers app that includes the mocked Celery and Redis clients
 */
export function setupTestDatabaseRedisCelery(
  celeryRunCalls: { task: string; args: any[] }[],
  redisSetExCalls: Record<string, { key: string; expiration: number; value: string }>,
  options?: { logging?: boolean | ((sql: string) => void) }
): TestDatabase {
  const db = setupTestDatabase(options)
  const celeryClient = {
    run: async (task: { task: string; args: any[] }) => {
      celeryRunCalls.push(task)
      return {} as any
    },
  } as CeleryClient

  // mock REDIS client service
  const redisClient = {
    client: {
      setEx: async (key: string, expiration: number, value: string) => {
        redisSetExCalls[key] = { key, expiration, value }
        return 'OK'
      },
      get: async (key: string) => {
        const record = redisSetExCalls[key]
        return record ? record.value : null
      },
      del: async (key: string) => {
        delete redisSetExCalls[key]
        return 1
      },
    } as RedisClient,
  }
  ;(db.app as any).get = (key: string) => {
    switch (key) {
      case 'magicLink':
        return { secret: 'test-magic-link-secret', expiration: 300 }
      case 'sequelizeClient':
        return db.sequelize
      case 'authentication':
        return { secret: 'test-secret-key' }
      case 'celeryClient':
        return celeryClient
      case 'redisClient': // Sometimes used via get instead of service
        return redisClient
      default:
        return {}
    }
  }

  // 4. Patch the FeatherJS app.service
  ;(db.app as any).service = (name: string) => {
    if (name === 'redisClient') return redisClient
    // Fallback to empty mock or actual service if needed
    return {} as any
  }

  return db
}

/**
 * Closes database connection
 */
export async function teardownTestDatabase(db: TestDatabase): Promise<void> {
  await db.sequelize.close()
}
