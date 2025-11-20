import { strict as assert } from 'assert'
import { Sequelize } from 'sequelize'
import { NotFound } from '@feathersjs/errors'
import { SpecialMembershipAccessService } from '../../../src/services/special-membership-access/special-membership-access.class'
import SpecialMembershipAccess, {
  ISpecialMembershipAccessAttributes,
} from '../../../src/models/special-membership-access.model'
import type { ImpressoApplication } from '../../../src/types'

const mockData: ISpecialMembershipAccessAttributes[] = Array.from({ length: 32 }, (_, i) => ({
  id: i + 1,
  title: `Access ${i + 1}`,
  bitmapPosition: i + 1,
}))

describe('SpecialMembershipAccessService', () => {
  let service: SpecialMembershipAccessService
  let sequelize: Sequelize
  let model: ReturnType<typeof SpecialMembershipAccess.initialize>

  before(async () => {
    // Create an in-memory SQLite database for testing
    sequelize = new Sequelize({
      dialect: 'sqlite',
      storage: ':memory:',
      logging: false,
    })

    // Initialize the model
    model = SpecialMembershipAccess.initialize(sequelize)

    // Sync the database
    await sequelize.sync({ force: true })

    // Create a mock application
    const app = {
      get: (key: string) => {
        if (key === 'sequelizeClient') return sequelize
        return undefined
      },
    } as ImpressoApplication

    service = new SpecialMembershipAccessService(app)
  })

  after(async () => {
    await sequelize.close()
  })

  beforeEach(async () => {
    // Clear the table before each test
    await model.destroy({ where: {}, truncate: true })
  })

  describe('find', () => {
    it('should return empty results when no records exist', async () => {
      const result = await service.find()

      assert.ok(Array.isArray(result.data))
      assert.strictEqual(result.data.length, 0)
      assert.strictEqual(result.pagination.total, 0)
      assert.strictEqual(result.pagination.limit, 10)
      assert.strictEqual(result.pagination.offset, 0)
    })
    it('should return paginated results', async () => {
      // Insert mock data
      await model.bulkCreate(mockData)
      const result = await service.find({ query: { limit: 5, offset: 10 } })

      assert.ok(Array.isArray(result.data))
      assert.strictEqual(result.data.length, 5)
      assert.strictEqual(result.pagination.total, mockData.length)
      assert.strictEqual(result.pagination.limit, 5)
      assert.strictEqual(result.pagination.offset, 10)
    })
  })

  describe('get', () => {
    it('should retrieve a record by id', async () => {
      // Create test data
      const created = await model.create(mockData[0])

      const result = await service.get(1)

      assert.ok(typeof result === 'object')
      assert.strictEqual(result.id, created.id)
    })

    it('should throw NotFound error when record does not exist', async () => {
      await assert.rejects(
        async () => {
          await service.get(999)
        },
        (error: any) => {
          assert.ok(error instanceof NotFound)
          assert.ok(error.message.includes('SpecialMembershipAccess with id 999 not found'))
          return true
        }
      )
    })

    it('should handle string ids', async () => {
      // Create test data
      await model.create({ id: 42, title: 'Access 42', bitmapPosition: 42 })
      const result = await service.get('42')
      assert.ok(typeof result === 'object')
      assert.strictEqual(result.id, 42)
    })
  })
})
