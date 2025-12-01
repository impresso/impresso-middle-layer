import { strict as assert } from 'assert'
import { NotFound } from '@feathersjs/errors'
import { SpecialMembershipAccessService } from '../../../src/services/special-membership-access/special-membership-access.class'
import type { ISpecialMembershipAccessAttributes } from '../../../src/models/special-membership-access.model'

import User from '../../../src/models/users.model'
import { setupTestDatabase, teardownTestDatabase, TestDatabase } from '../../helpers/database'
import UserSpecialMembershipRequest from '../../../src/models/user-special-membership-requests.model'
import SpecialMembershipAccess from '../../../src/models/special-membership-access.model'

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

describe('SpecialMembershipAccessService', () => {
  let db: TestDatabase
  let service: SpecialMembershipAccessService
  let userModel: ReturnType<typeof User.sequelize>
  let specialMembershipAccessModel: ReturnType<typeof SpecialMembershipAccess.initialize>
  let userSpecialMembershipRequestModel: ReturnType<typeof UserSpecialMembershipRequest.initialize>

  before(async () => {
    // Setup database once for all tests
    db = setupTestDatabase()
    userModel = User.sequelize(db.sequelize)
    specialMembershipAccessModel = SpecialMembershipAccess.initialize(db.sequelize)
    userSpecialMembershipRequestModel = UserSpecialMembershipRequest.initialize(db.sequelize)
    await db.sequelize.sync({ force: true })
    service = new SpecialMembershipAccessService(db.app)
  })

  after(async () => {
    await teardownTestDatabase(db)
  })

  beforeEach(async () => {
    // Clear the tables before each test
    await db.sequelize.truncate({ cascade: true })
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
      await SpecialMembershipAccess.bulkCreate(mockData)

      const limit = 5
      const result = await service.find({ query: { limit, offset: 10 } })

      assert.ok(Array.isArray(result.data))
      assert.strictEqual(result.data.length, limit)
      assert.strictEqual(result.pagination.total, mockData.length)
      assert.strictEqual(result.pagination.limit, limit)
      assert.strictEqual(result.pagination.offset, 10)
      // the requests array should be empty
      result.data.forEach(record => {
        assert.strictEqual(record.requests?.length, undefined)
      })
    })

    it('should return the request connected for the given user', async () => {
      // Insert mock data
      await SpecialMembershipAccess.bulkCreate(mockData) // all access records
      await userModel.create(mockUsers[0] as any) // as ID = 1
      // add a request related to already existing user (foreignKey!)
      // for the very first access record
      await UserSpecialMembershipRequest.create({
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
      const created = await SpecialMembershipAccess.create(mockData[0])

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
      await SpecialMembershipAccess.create({ id: 42, title: 'Access 42', bitmapPosition: 42 })
      const result = await service.get('42')
      assert.ok(typeof result === 'object')
      assert.strictEqual(result.id, 42)
    })
  })
})
