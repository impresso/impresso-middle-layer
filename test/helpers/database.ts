import { Sequelize } from 'sequelize'
import { initializeModels, associateModels } from '../../src/models'
import { ImpressoApplication } from '../../src/types'

export interface TestDatabase {
  sequelize: Sequelize
  app: ImpressoApplication
  models: typeof Sequelize.prototype.models
}

/**
 * Creates an in-memory SQLite database for testing
 */
export async function setupTestDatabase(options?: {
  logging?: boolean | ((sql: string) => void)
}): Promise<TestDatabase> {
  const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: ':memory:',
    logging: options?.logging ?? false,
    define: {
      timestamps: false,
    },
  })
  // Initialize models
  initializeModels(sequelize)
  // Create tables
  await sequelize.sync({ force: true })
  // Set up associations
  associateModels(sequelize)
  // Mock Feathers app
  const app = {
    get: (key: string) => (key === 'sequelizeClient' ? sequelize : undefined),
  } as ImpressoApplication

  return {
    sequelize,
    app,
    models: sequelize.models,
  }
}

/**
 * Closes database connection
 */
export async function teardownTestDatabase(db: TestDatabase): Promise<void> {
  await db.sequelize.close()
}
