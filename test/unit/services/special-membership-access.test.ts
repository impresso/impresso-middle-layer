import { strict as assert } from 'assert'
import { BadRequest, Forbidden, NotAuthenticated, NotFound } from '@feathersjs/errors'
import { SpecialMembershipAccessService } from '@/services/special-membership-access/special-membership-access.class.js'
import { validateBitmapPositionsQuery } from '@/services/special-membership-access/special-membership-access.service.js'
import type { ISpecialMembershipAccessAttributes } from '@/models/special-membership-access.model.js'

import User from '@/models/users.model.js'
import { setupTestDatabase, teardownTestDatabase, TestDatabase } from '../../helpers/database.js'
import UserSpecialMembershipRequest from '@/models/user-special-membership-requests.model.js'
import SpecialMembershipAccess from '@/models/special-membership-access.model.js'

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

  describe('validateBitmapPositionsQuery', () => {
    it('should throw BadRequest when bitmapPositions contains non-integer values', async () => {
      const hook = validateBitmapPositionsQuery()

      await assert.rejects(
        () =>
          hook({
            params: {
              query: {
                bitmapPositions: ['2', 'invalid'],
              },
            },
          } as any),
        (error: any) => {
          assert.strictEqual(error.code, 400)
          assert.strictEqual(error.message, '`bitmapPositions` must be an array of integers')
          return true
        }
      )
    })
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

    it('should filter results by bitmap positions when provided', async () => {
      await SpecialMembershipAccess.bulkCreate(mockData.slice(0, 5))

      const result = await service.find({ query: { bitmapPositions: [2, 4] } })

      assert.strictEqual(result.pagination.total, 2)
      assert.deepStrictEqual(
        result.data.map(record => record.bitmapPosition).sort((a, b) => a - b),
        [2, 4]
      )
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
      const result = await service.find({
        query: { limit, offset: 0 },
        user: { uid: '1', bitmap: BigInt(0), groups: [], id: 1, isStaff: false },
      })

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

  describe('patch', () => {
    it('should reject unauthenticated patch requests', async () => {
      const created = await SpecialMembershipAccess.create({
        title: 'Access 1',
        bitmapPosition: 1,
        reviewerId: 1,
      })

      await assert.rejects(
        () => service.patch(created.id, { metadata: { modality: 'notify_reviewer' } }, {} as any),
        (error: any) => {
          assert.ok(error instanceof NotAuthenticated)
          return true
        }
      )
    })

    it('should reject patch requests from non-reviewers', async () => {
      const created = await SpecialMembershipAccess.create({
        title: 'Access 2',
        bitmapPosition: 2,
        reviewerId: 1,
      })

      await assert.rejects(
        () =>
          service.patch(created.id, { metadata: { modality: 'notify_reviewer' } }, {
            user: { uid: '2', bitmap: BigInt(0), groups: [], id: 2, isStaff: false },
          } as any),
        (error: any) => {
          assert.ok(error instanceof Forbidden)
          return true
        }
      )
    })

    it('should allow the assigned reviewer to patch metadata', async () => {
      const created = await SpecialMembershipAccess.create({
        title: 'Access 3',
        bitmapPosition: 3,
        reviewerId: 1,
        metadata: { modality: 'notify_reviewer' },
      })

      const updated = await service.patch(
        created.id,
        { metadata: { modality: 'cc_reviewer', expireDate: '2026-05-01' } },
        { user: { uid: '1', bitmap: BigInt(0), groups: [], id: 1, isStaff: false } } as any
      )

      assert.deepStrictEqual(updated.metadata, { modality: 'cc_reviewer', expireDate: '2026-05-01' })
      assert.strictEqual(updated.title, 'Access 3')
      assert.strictEqual(updated.bitmapPosition, 3)
    })

    it('should reject payload keys other than metadata', async () => {
      const created = await SpecialMembershipAccess.create({
        title: 'Access 4',
        bitmapPosition: 4,
        reviewerId: 1,
      })

      await assert.rejects(
        () =>
          service.patch(
            created.id,
            { metadata: { modality: 'notify_reviewer' }, title: 'not-allowed' } as any,
            { user: { uid: '1', bitmap: BigInt(0), groups: [], id: 1, isStaff: false } } as any
          ),
        (error: any) => {
          assert.ok(error instanceof BadRequest)
          assert.match(error.message, /Only `metadata` can be updated/)
          return true
        }
      )
    })

    it('should reject metadata when missing', async () => {
      const created = await SpecialMembershipAccess.create({
        title: 'Access 5',
        bitmapPosition: 5,
        reviewerId: 1,
      })

      await assert.rejects(
        () =>
          service.patch(created.id, {}, {
            user: { uid: '1', bitmap: BigInt(0), groups: [], id: 1, isStaff: false },
          } as any),
        (error: any) => {
          assert.ok(error instanceof BadRequest)
          assert.match(error.message, /`metadata` is required/)
          return true
        }
      )
    })

    it('should reject metadata when null', async () => {
      const created = await SpecialMembershipAccess.create({
        title: 'Access 6',
        bitmapPosition: 6,
        reviewerId: 1,
      })

      await assert.rejects(
        () =>
          service.patch(created.id, { metadata: null as any }, {
            user: { uid: '1', bitmap: BigInt(0), groups: [], id: 1, isStaff: false },
          } as any),
        (error: any) => {
          assert.ok(error instanceof BadRequest)
          assert.match(error.message, /`metadata` must be an object/)
          return true
        }
      )
    })

    it('should return NotFound when record does not exist', async () => {
      await assert.rejects(
        () =>
          service.patch(999, { metadata: { modality: 'notify_reviewer' } }, {
            user: { uid: '1', bitmap: BigInt(0), groups: [], id: 1, isStaff: false },
          } as any),
        (error: any) => {
          assert.ok(error instanceof NotFound)
          assert.ok(error.message.includes('SpecialMembershipAccess with id 999 not found'))
          return true
        }
      )
    })
  })
})
