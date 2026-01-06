import { strict as assert } from 'assert'
import { BadRequest, NotFound } from '@feathersjs/errors'
import { UserSpecialMembershipRequestService } from '@/services/user-special-membership-requests/user-special-membership-requests.class.js'
import UserSpecialMembershipRequest, {
  IUserSpecialMembershipRequestAttributes,
} from '@/models/user-special-membership-requests.model.js'

import User from '@/models/users.model.js'
import SpecialMembershipAccess, {
  ISpecialMembershipAccessAttributes,
} from '@/models/special-membership-access.model.js'
import type { TestDatabase } from '../../helpers/database.js'
import { setupTestDatabase, teardownTestDatabase } from '../../helpers/database.js'

// --- Mock Test Data -------------------------------------

const mockUsers = Array.from({ length: 42 }, (_, i) => ({
  uid: `user${i + 1}`,
  id: i + 1,
  username: `local-${i + 1}`,
  firstname: `First ${i + 1}`,
  lastname: `Last ${i + 1}`,
  email: `user${i + 1}@example.com`,
  password: 'test',
}))

const mockSubscriptions = [
  { id: 1, title: 'gold', bitmapPosition: 1 },
  { id: 2, title: 'silver', bitmapPosition: 2 },
  { id: 3, title: 'bronze', bitmapPosition: 3 },
  { id: 4, title: 'platinum', bitmapPosition: 4 },
  { id: 5, title: 'diamond', bitmapPosition: 5 },
] as ISpecialMembershipAccessAttributes[]

const mockRequests: IUserSpecialMembershipRequestAttributes[] = Array.from({ length: mockUsers.length }, (_, i) => ({
  id: i + 1,
  reviewerId: null,
  userId: i + 1, // must exist in User
  specialMembershipAccessId: (i % mockSubscriptions.length) + 1, // or set 1/2 if testing relations
  dateCreated: new Date(),
  dateLastModified: new Date(),
  status: 'pending',
  changelog: [
    {
      status: 'pending',
      subscription: mockSubscriptions[i % mockSubscriptions.length].title,
      date: new Date().toISOString(),
      reviewer: '',
      notes: 'Initial request',
    },
  ],
}))

// ---------------------------------------------------------

describe('UserSpecialMembershipRequestService', () => {
  let db: TestDatabase
  let service: UserSpecialMembershipRequestService
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

    service = new UserSpecialMembershipRequestService(db.app)
  })

  after(async () => {
    await teardownTestDatabase(db)
  })

  beforeEach(async () => {
    // Clear the tables before each test
    await db.sequelize.truncate({ cascade: true })
    // Insert related mock data
    await userModel.bulkCreate(mockUsers as any)
    await specialMembershipAccessModel.bulkCreate(mockSubscriptions)
    await userSpecialMembershipRequestModel.bulkCreate(mockRequests)
  })

  // ---------------------------------------------------------
  // FIND TESTS
  // ---------------------------------------------------------
  describe('find', () => {
    it('should return empty results when no records exist', async () => {
      const result = await service.find()

      assert.ok(Array.isArray(result.data))
      assert.strictEqual(result.data.length, 0)
      assert.strictEqual(result.pagination.total, 0)
    })

    it('should return paginated results, only for the specified user', async () => {
      const result = await service.find({ query: { limit: 5, offset: 0 }, user: { id: 15 } })

      assert.strictEqual(result.data.length, 1)
      assert.strictEqual(result.pagination.total, 1)
      // should have the specialMembershipAccess included
      assert.ok(result.data[0].specialMembershipAccess)
      assert.strictEqual(result.data[0].userId, 15)
      assert.strictEqual(result.data[0].specialMembershipAccess?.id, 5) // subscription id for user 15
    })
  })

  // ---------------------------------------------------------
  // GET TESTS
  // ---------------------------------------------------------
  describe('get', () => {
    it('should retrieve a record by id', async () => {
      const result = await service.get(1, { user: { id: 1 } })
      assert.strictEqual(result.id, 1)
    })
    it('should throw NotFound when user is not correct', async () => {
      await assert.rejects(
        async () => service.get(1, { user: { id: 2 } }),
        (error: any) => {
          assert.ok(error instanceof NotFound)
          return true
        }
      )
    })
    it('should throw NotFound when missing', async () => {
      await assert.rejects(
        async () => service.get(999, { user: { id: 1 } }),
        (error: any) => {
          assert.ok(error instanceof NotFound)
          return true
        }
      )
    })
  })

  describe('create', () => {
    it('should create a new request', async () => {
      const now = new Date()
      const result = await service.create(
        {
          specialMembershipAccessId: 2,
          notes: 'Please approve my request.',
        },
        { user: { id: 3 } }
      )

      assert.strictEqual(result.userId, 3)
      assert.strictEqual(result.specialMembershipAccessId, 2)
      assert.strictEqual(result.status, 'pending')
      assert.ok(result.dateCreated >= now)
      assert.ok(result.dateLastModified >= now)
      assert.ok(Array.isArray(result.changelog))
      assert.strictEqual(result.changelog.length, 1)
      assert.strictEqual(result.changelog[0].status, 'pending')
      assert.strictEqual(result.changelog[0].subscription, 'silver')
      assert.strictEqual(result.changelog[0].notes, 'Please approve my request.')
    })

    it('should throw BadRequest when specialMembershipAccessId is missing', async () => {
      await assert.rejects(
        async () =>
          service.create(
            {
              notes: 'Missing subscription id',
            } as any,
            { user: { id: 3 } }
          ),
        (error: any) => {
          assert.ok(error instanceof BadRequest)
          assert.strictEqual(error.message, 'specialMembershipAccessId is required')
          return true
        }
      )
    })

    it('should throw NotFound when specialMembershipAccessId does not exist', async () => {
      await assert.rejects(
        async () =>
          service.create(
            {
              specialMembershipAccessId: 999,
              notes: 'Non-existing subscription id',
            },
            { user: { id: 3 } }
          ),
        (error: any) => {
          assert.ok(error instanceof NotFound)
          assert.strictEqual(error.message, 'SpecialMembershipAccess with id 999 not found')
          return true
        }
      )
    })
  })
})
