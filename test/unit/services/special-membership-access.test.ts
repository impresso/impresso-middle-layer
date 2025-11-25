import { strict as assert } from 'assert'
import { Sequelize } from 'sequelize'
import { NotFound } from '@feathersjs/errors'
import { SpecialMembershipAccessService } from '../../../src/services/special-membership-access/special-membership-access.class'
import SpecialMembershipAccess, {
  ISpecialMembershipAccessAttributes,
} from '../../../src/models/special-membership-access.model'
import UserSpecialMembershipRequest, {
  IUserSpecialMembershipRequestAttributes,
} from '../../../src/models/user-special-membership-requests.model'
import type { ImpressoApplication } from '../../../src/types'
import User from '../../../src/models/users.model'

const mockUsers = Array.from({ length: 2 }, (_, i) => ({
  uid: `user${i + 1}`,
  id: i + 1,
  username: `local-${i + 1}`,
  firstname: `First ${i + 1}`,
  lastname: `Last ${i + 1}`,
  email: `user${i + 1}@example.com`,
  password: 'test',
}))

const mockData: ISpecialMembershipAccessAttributes[] = Array.from({ length: 32 }, (_, i) => ({
  id: i + 1,
  title: `Access ${i + 1}`,
  bitmapPosition: i + 1,
}))

const mockUserSpecialMembershipRequestsData: IUserSpecialMembershipRequestAttributes[] = [
  {
    id: 1,
    reviewerId: null,
    userId: 1,
    specialMembershipAccessId: mockData[0].id,
    dateCreated: new Date(),
    dateLastModified: new Date(),
    status: 'pending',
    changelog: [],
  },
  {
    id: 2,
    reviewerId: null,
    userId: 2,
    specialMembershipAccessId: mockData[0].id,
    dateCreated: new Date(),
    dateLastModified: new Date(),
    status: 'pending',
    changelog: [],
  },
]

describe('SpecialMembershipAccessService', () => {
  let service: SpecialMembershipAccessService
  let sequelize: Sequelize
  let model: ReturnType<typeof SpecialMembershipAccess.initialize>
  let userModel: ReturnType<typeof User.sequelize>
  let userSpecialMembershipRequestModel: ReturnType<typeof UserSpecialMembershipRequest.initialize>

  before(async () => {
    // Create an in-memory SQLite database for testing
    sequelize = new Sequelize({
      dialect: 'sqlite',
      storage: ':memory:',
      logging: false,
    })
    userModel = User.sequelize(sequelize)
    model = SpecialMembershipAccess.initialize(sequelize)
    userSpecialMembershipRequestModel = UserSpecialMembershipRequest.initialize(sequelize)

    // Create a mock application
    const app = {
      get: (key: string) => {
        if (key === 'sequelizeClient') return sequelize
        return undefined
      },
    } as ImpressoApplication

    service = new SpecialMembershipAccessService(app)
    await sequelize.sync({ force: true })
  })

  after(async () => {
    await sequelize.close()
  })

  beforeEach(async () => {
    // Clear the table before each test
    await userSpecialMembershipRequestModel.destroy({ where: {}, truncate: true })
    await userModel.destroy({ where: {}, truncate: true })
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
    it('should return correctly paginated results for all users', async () => {
      // Insert mock data
      await model.bulkCreate(mockData)

      const limit = 5
      const result = await service.find({ query: { limit, offset: 10 } })

      assert.ok(Array.isArray(result.data))
      assert.strictEqual(result.data.length, limit)
      assert.strictEqual(result.pagination.total, mockData.length)
      assert.strictEqual(result.pagination.limit, limit)
      assert.strictEqual(result.pagination.offset, 10)
      // the requests array should be empty
      console.log('Result data:', result.data)
      result.data.forEach(record => {
        assert.strictEqual(record.requests?.length, undefined)
      })
    })

    it('should return the request connected for the given user', async () => {
      // Insert mock data
      await model.bulkCreate(mockData) // all access records
      await userModel.create(mockUsers[0] as any) // as ID = 1
      // add a request related to already existing user (foreignKey!)
      // for the very first access record
      await userSpecialMembershipRequestModel.create({
        id: 1,
        reviewerId: null,
        userId: 1,
        specialMembershipAccessId: mockData[0].id,
        dateCreated: new Date(),
        dateLastModified: new Date(),
        status: 'pending',
        changelog: [],
      })
      const limit = 5
      const result = await service.find({ query: { limit, offset: 0 }, user: { id: 1 } })

      assert.ok(Array.isArray(result.data))
      assert.strictEqual(result.data.length, limit)
      // the first access record should have the request attached
      const firstRecord = result.data.find(record => record.id === mockData[0].id)
      assert.ok(firstRecord)
      assert.ok(Array.isArray(firstRecord!.requests))
      assert.strictEqual(firstRecord!.requests!.length, 1)
      assert.strictEqual(firstRecord!.requests![0].userId, 1)
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
