import { strict as assert } from 'assert'
import { BadRequest, Forbidden, NotAuthenticated, NotFound } from '@feathersjs/errors'
import { SpecialMembershipAccessService } from '@/services/special-membership-access/special-membership-access.class.js'
import { validateBitmapPositionsQuery } from '@/services/special-membership-access/special-membership-access.service.js'
import type {
  ISpecialMembershipAccessAttributes,
  SpecialMembershipAccessMetadata,
} from '@/models/special-membership-access.model.js'

import User from '@/models/users.model.js'
import UserSpecialMembershipRequest from '@/models/user-special-membership-requests.model.js'
import SpecialMembershipAccess from '@/models/special-membership-access.model.js'
import { setupTestApp, withCacheManager, withDatabase } from '../../../helpers/app.js'

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

const initialMetadata: SpecialMembershipAccessMetadata = {
  modality: 'cc_reviewer',
  enableTemporaryAutomaticApproval: false,
  revokeAfterDays: null,
  revokeTemporaryAutomaticApprovalAfterDays: null,
}

const updatedMetadata: SpecialMembershipAccessMetadata = {
  modality: 'notify_reviewer',
  enableTemporaryAutomaticApproval: true,
  revokeAfterDays: 7,
  revokeTemporaryAutomaticApprovalAfterDays: 14,
}

describe('SpecialMembershipAccessService', () => {
  let testApp: Awaited<ReturnType<typeof setupTestApp<[ReturnType<typeof withDatabase>]>>>

  let service: SpecialMembershipAccessService
  let userModel: ReturnType<typeof User.sequelize>
  let specialMembershipAccessModel: ReturnType<typeof SpecialMembershipAccess.initialize>
  let userSpecialMembershipRequestModel: ReturnType<typeof UserSpecialMembershipRequest.initialize>

  before(function () {
    this.timeout(10000)
  })

  before(async () => {
    // Setup database once for all tests
    testApp = setupTestApp(withDatabase(), withCacheManager())
    userModel = User.sequelize(testApp.sequelize)
    specialMembershipAccessModel = SpecialMembershipAccess.initialize(testApp.sequelize)
    userSpecialMembershipRequestModel = UserSpecialMembershipRequest.initialize(testApp.sequelize)
    await testApp.sequelize.sync({ force: true })
    service = new SpecialMembershipAccessService(testApp.app)
  })

  after(async () => {
    await testApp.teardown()
  })

  beforeEach(async () => {
    await testApp.sequelize.truncate({ cascade: true })
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
    it('should allow the reviewer to update metadata only', async () => {
      await SpecialMembershipAccess.create({
        ...mockData[0],
        reviewerId: 1,
        metadata: initialMetadata,
      })

      const result = await service.patch(
        1,
        { metadata: updatedMetadata },
        { user: { uid: '1', bitmap: BigInt(0), groups: [], id: 1, isStaff: false } }
      )

      assert.deepStrictEqual(result.metadata, updatedMetadata)
      assert.strictEqual(result.title, mockData[0].title)
      assert.strictEqual(result.bitmapPosition, mockData[0].bitmapPosition)
    })

    it('should throw Forbidden when a non-reviewer patches the record', async () => {
      await SpecialMembershipAccess.create({
        ...mockData[0],
        reviewerId: 1,
        metadata: initialMetadata,
      })

      await assert.rejects(
        () =>
          service.patch(
            1,
            { metadata: updatedMetadata },
            { user: { uid: '2', bitmap: BigInt(0), groups: [], id: 2, isStaff: false } }
          ),
        (error: any) => {
          assert.ok(error instanceof Forbidden)
          assert.strictEqual(error.message, 'Only the reviewer of this item can update its metadata')
          return true
        }
      )
    })

    it('should throw BadRequest when payload is empty', async () => {
      await SpecialMembershipAccess.create({
        ...mockData[0],
        reviewerId: 1,
        metadata: initialMetadata,
      })

      await assert.rejects(
        () => service.patch(1, {}, { user: { uid: '1', bitmap: BigInt(0), groups: [], id: 1, isStaff: false } }),
        (error: any) => {
          assert.ok(error instanceof BadRequest)
          assert.strictEqual(error.message, 'metadata is required')
          return true
        }
      )
    })

    it('should throw BadRequest when payload contains unexpected fields', async () => {
      await SpecialMembershipAccess.create({
        ...mockData[0],
        reviewerId: 1,
        metadata: initialMetadata,
      })

      await assert.rejects(
        () =>
          service.patch(1, { metadata: updatedMetadata, title: 'not allowed' } as any, {
            user: { uid: '1', bitmap: BigInt(0), groups: [], id: 1, isStaff: false },
          }),
        (error: any) => {
          assert.ok(error instanceof BadRequest)
          assert.strictEqual(error.message, 'Only metadata can be updated')
          return true
        }
      )
    })

    it('should throw NotAuthenticated when patching without a user', async () => {
      await SpecialMembershipAccess.create({
        ...mockData[0],
        reviewerId: 1,
        metadata: initialMetadata,
      })

      await assert.rejects(
        () => service.patch(1, { metadata: updatedMetadata }),
        (error: any) => {
          assert.ok(error instanceof NotAuthenticated)
          assert.strictEqual(error.message, 'Authentication required')
          return true
        }
      )
    })
  })

  describe('cache-aware methods', () => {
    describe('getByBitmapPosition', () => {
      it('should retrieve a record by bitmap position', async () => {
        await SpecialMembershipAccess.create(mockData[0])

        const result = await service.getByBitmapPosition(mockData[0].bitmapPosition)

        assert.ok(result)
        assert.strictEqual(result.bitmapPosition, mockData[0].bitmapPosition)
        assert.strictEqual(result.title, mockData[0].title)
      })

      it('should return undefined when record does not exist', async () => {
        const result = await service.getByBitmapPosition(9999)

        assert.strictEqual(result, undefined)
      })
    })

    describe('getLookup', () => {
      it('should return an empty object when cache is empty', async () => {
        const result = await service.getLookup()

        assert.deepStrictEqual(result, {})
      })

      it('should return the cached lookup when available', async () => {
        const mockLookup = {
          '1': { id: 1, title: 'Access 1', bitmapPosition: 1 },
          '2': { id: 2, title: 'Access 2', bitmapPosition: 2 },
        }

        await testApp.app
          .get('cacheManager')
          .set('cache:specialMembershipAccess:byBitmapPosition', JSON.stringify(mockLookup), 60000)

        const result = await service.getLookup()

        assert.deepStrictEqual(result, mockLookup)
      })

      it('should handle parse errors gracefully and return empty object', async () => {
        // Set invalid JSON in cache
        await testApp.app
          .get('cacheManager')
          .set('cache:specialMembershipAccess:byBitmapPosition', 'invalid json', 60000)

        const result = await service.getLookup()

        assert.deepStrictEqual(result, {})
      })
    })
  })
})
