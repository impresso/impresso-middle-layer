import { Sequelize } from 'sequelize'
import { ImpressoApplication } from '@/types.js'

export interface TestDatabase {
  sequelize: Sequelize
  app: ImpressoApplication
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
 * Closes database connection
 */
export async function teardownTestDatabase(db: TestDatabase): Promise<void> {
  await db.sequelize.close()
}
