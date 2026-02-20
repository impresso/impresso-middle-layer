import { strict as assert } from 'assert'
// Feathers
import type { TestDatabase } from '../../helpers/database.js'
import { setupTestDatabase, teardownTestDatabase } from '../../helpers/database.js'
// Models
import UserSpecialMembershipRequest, {
  IUserSpecialMembershipRequestAttributes,
} from '@/models/user-special-membership-requests.model.js'
import SpecialMembershipAccess, {
  ISpecialMembershipAccessAttributes,
} from '@/models/special-membership-access.model.js'
import User from '@/models/users.model.js'
// Services
import { UserSpecialMembershipRequestReviewsService } from '@/services/user-special-membership-requests-reviews/user-special-membership-requests-reviews.class.js'
import Group from '@/models/groups.model.js'

// --- Mock Test Data -------------------------------------
const mockUserPlans = ['plan-basic', 'plan-educational', 'plan-researcher'].map((name, index) => ({
  id: index + 1,
  name,
}))

const mockUsers = Array.from({ length: 3 }, (_, i) => ({
  uid: `user${i + 1}`,
  id: i + 1,
  username: `local-${i + 1}`,
  firstname: `First ${i + 1}`,
  lastname: `Last ${i + 1}`,
  email: `user${i + 1}@example.com`,
  password: 'test',
}))
const mockReviewerUserA = {
  uid: `reviewer1`,
  id: 999,
  username: `local-reviewer1`,
  firstname: `Reviewer First`,
  lastname: `Reviewer Last`,
  email: `reviewer1@example.com`,
  password: 'test',
}
const mockReviewerUserB = {
  uid: `reviewer2`,
  id: 1000,
  username: `local-reviewer2`,
  firstname: `Reviewer2 First`,
  lastname: `Reviewer2 Last`,
  email: `reviewer2@example.com`,
  password: 'test',
}
// mix up reviewer ids for subscriptions
const mockSpecialMembershipAccesses: ISpecialMembershipAccessAttributes[] = [
  { id: 1, title: 'gold', bitmapPosition: 1, reviewerId: mockReviewerUserB.id },
  { id: 2, title: 'silver', bitmapPosition: 2, reviewerId: mockReviewerUserA.id },
  { id: 3, title: 'bronze', bitmapPosition: 3, reviewerId: mockReviewerUserA.id },
  { id: 4, title: 'platinum', bitmapPosition: 4, reviewerId: mockReviewerUserB.id },
  { id: 5, title: 'diamond', bitmapPosition: 5, reviewerId: mockReviewerUserA.id },
]

const mockRequestsForReviewerA = [
  // subscription id 2
  {
    id: 10,
    reviewerId: null,
    userId: 1,
    specialMembershipAccessId: 2,
    dateCreated: new Date(),
    dateLastModified: new Date(),
    status: 'pending',
    changelog: [
      {
        status: 'pending',
        subscription: 'silver',
        date: new Date().toISOString(),
        reviewer: '',
        notes: 'Initial request',
      },
    ],
  },
  // subscription id 3
  {
    id: 11,
    reviewerId: null,
    userId: 2,
    specialMembershipAccessId: 3,
    dateCreated: new Date(),
    dateLastModified: new Date(),
    status: 'pending',
    changelog: [
      {
        status: 'pending',
        subscription: 'bronze',
        date: new Date().toISOString(),
        reviewer: '',
        notes: 'Initial request',
      },
    ],
  },
  // subscription id 5, same user
  {
    id: 12,
    reviewerId: null,
    userId: 2,
    specialMembershipAccessId: 5,
    dateCreated: new Date(),
    dateLastModified: new Date(),
    status: 'pending',
    changelog: [
      {
        status: 'pending',
        subscription: 'diamond',
        date: new Date().toISOString(),
        reviewer: '',
        notes: 'Initial request',
      },
    ],
  },
] as IUserSpecialMembershipRequestAttributes[]

describe('UserSpecialMembershipRequestReviewsService', () => {
  let db: TestDatabase
  let service: UserSpecialMembershipRequestReviewsService
  let userModel: ReturnType<typeof User.sequelize>
  let groupModel: ReturnType<typeof Group.initModel>
  let specialMembershipAccessModel: ReturnType<typeof SpecialMembershipAccess.initialize>
  let userSpecialMembershipRequestModel: ReturnType<typeof UserSpecialMembershipRequest.initialize>

  before(async () => {
    // Setup database once for all tests
    db = setupTestDatabase({
      logging: false,
    })
    userModel = User.sequelize(db.sequelize)
    specialMembershipAccessModel = SpecialMembershipAccess.initialize(db.sequelize)
    userSpecialMembershipRequestModel = UserSpecialMembershipRequest.initialize(db.sequelize)
    groupModel = Group.initModel(db.sequelize)
    await db.sequelize.sync({ force: true })

    service = new UserSpecialMembershipRequestReviewsService(db.app)
  })

  after(async () => {
    await teardownTestDatabase(db)
  })

  beforeEach(async () => {
    // Clear the tables before each test
    await db.sequelize.truncate({ cascade: true })
    // Insert related mock data
    // Insert groups for users
    await groupModel.bulkCreate(mockUserPlans as any)

    const users = await userModel.bulkCreate(mockUsers as any, {
      include: ['groups'],
    })
    // @ts-ignore add groups to users, User model doesn't have addGroup typed
    await users[0].addGroup(1)
    // @ts-ignore
    await users[1].addGroup(2)
    // @ts-ignore
    await users[2].addGroup(3)
    await userModel.create(mockReviewerUserA as any)
    await userModel.create(mockReviewerUserB as any)
    await specialMembershipAccessModel.bulkCreate(mockSpecialMembershipAccesses)
  })
  // ... Add tests for the review service here ...
  describe('find', () => {
    it('should return empty results when no records exist', async () => {
      const result = await service.find({
        user: { id: mockReviewerUserA.id },
      })

      assert.ok(Array.isArray(result.data))
      assert.strictEqual(result.data.length, 0)
      assert.strictEqual(result.pagination.total, 0)
    })

    it('should return requests assigned to the reviewer', async () => {
      // Create requests assigned to different reviewers
      await userSpecialMembershipRequestModel.bulkCreate(mockRequestsForReviewerA)

      const result = await service.find({
        user: { id: mockReviewerUserA.id },
      })
      // Reviewer A is assigned to subscriptions with ids 2, 3, and 5
      assert.strictEqual(result.pagination.total, mockRequestsForReviewerA.length)
    })
    it('should return APPROVED requests assigned to the reviewer, order by -date', async () => {
      // Create requests assigned to different reviewers
      await userSpecialMembershipRequestModel.bulkCreate(mockRequestsForReviewerA)

      const result = await service.find({
        user: { id: mockReviewerUserA.id },
        query: { status: ['approved'] },
      })
      // Reviewer A is assigned to subscriptions with ids 2, 3, and 5
      assert.strictEqual(result.pagination.total, 0)
    })
  })

  describe('get', () => {
    it('should return request for direct reviewer', async () => {
      // Create a request with direct reviewer assignment
      const directRequest = {
        id: 20,
        reviewerId: mockReviewerUserA.id,
        userId: 1,
        specialMembershipAccessId: 2,
        dateCreated: new Date(),
        dateLastModified: new Date(),
        status: 'pending',
        changelog: [],
      }
      await userSpecialMembershipRequestModel.create(directRequest as IUserSpecialMembershipRequestAttributes)

      const result = await service.get(20, {
        user: { id: mockReviewerUserA.id },
      })

      assert.ok(result)
      assert.strictEqual(result.id, 20)
      assert.strictEqual(result.reviewerId, mockReviewerUserA.id)
    })

    it('should return request for special access reviewer', async () => {
      // Create a request with special access reviewer (through subscription)
      const specialAccessRequest = {
        id: 21,
        reviewerId: null,
        userId: 1,
        specialMembershipAccessId: 2, // Assigned to reviewer A via special membership access
        dateCreated: new Date(),
        dateLastModified: new Date(),
        status: 'pending',
        changelog: [],
      }
      await userSpecialMembershipRequestModel.create(specialAccessRequest as IUserSpecialMembershipRequestAttributes)

      const result = await service.get(21, {
        user: { id: mockReviewerUserA.id },
      })

      assert.ok(result)
      assert.strictEqual(result.id, 21)
      assert.strictEqual(result.userId, 1)
    })

    it('should throw NotFound when reviewer is not authorized for direct review', async () => {
      // Create a request for reviewer B
      const directRequest = {
        id: 22,
        reviewerId: mockReviewerUserB.id,
        userId: 1,
        specialMembershipAccessId: 1,
        dateCreated: new Date(),
        dateLastModified: new Date(),
        status: 'pending',
        changelog: [],
      }
      await userSpecialMembershipRequestModel.create(directRequest as IUserSpecialMembershipRequestAttributes)

      try {
        await service.get(22, {
          user: { id: mockReviewerUserA.id },
        })
        assert.fail('Should have thrown NotFound')
      } catch (error: any) {
        assert.strictEqual(error.code, 404)
      }
    })

    it('should throw NotFound when reviewer is not authorized for special access review', async () => {
      // Create a request assigned to reviewer B via special membership access
      const specialAccessRequest = {
        id: 23,
        reviewerId: null,
        userId: 1,
        specialMembershipAccessId: 1, // Assigned to reviewer B
        dateCreated: new Date(),
        dateLastModified: new Date(),
        status: 'pending',
        changelog: [],
      }
      await userSpecialMembershipRequestModel.create(specialAccessRequest as IUserSpecialMembershipRequestAttributes)

      try {
        await service.get(23, {
          user: { id: mockReviewerUserA.id },
        })
        assert.fail('Should have thrown NotFound')
      } catch (error: any) {
        assert.strictEqual(error.code, 404)
      }
    })

    it('should throw NotFound for non-existent request', async () => {
      try {
        await service.get(9999, {
          user: { id: mockReviewerUserA.id },
        })
        assert.fail('Should have thrown NotFound')
      } catch (error: any) {
        assert.strictEqual(error.code, 404)
      }
    })
  })
})
