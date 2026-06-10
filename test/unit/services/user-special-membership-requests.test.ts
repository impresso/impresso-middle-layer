import { strict as assert } from 'assert'
import { BadRequest, NotFound } from '@feathersjs/errors'
import { UserSpecialMembershipRequestService } from '@/services/user-special-membership-requests/user-special-membership-requests.class.js'
import UserSpecialMembershipRequest, {
  IUserSpecialMembershipRequestAttributes,
  StatusPending,
  StatusPendingTemporary,
} from '@/models/user-special-membership-requests.model.js'

import User, { UserAttributes } from '@/models/users.model.js'
import SpecialMembershipAccess from '@/models/special-membership-access.model.js'
import type { TestDatabase } from '../../helpers/database.js'
import { setupTestDatabase, teardownTestDatabase } from '../../helpers/database.js'
import {
  mockSpecialMembershipAccesses,
  MockSubscriptionWithRevokableAfterDays,
  MockSubscriptionWithRevokableTemporaryAfterDays,
} from '../../mockData/specialMembershipAccess.js'
import { generateMockUserSpecialMembershipRequest } from '../../mockData/userSpecialMembershipRequests.js'

const mockUsers = Array.from({ length: 4 }, (_, i) => ({
  uid: `user${i + 1}`,
  id: i + 1,
  username: `local-${i + 1}`,
  firstname: `First ${i + 1}`,
  lastname: `Last ${i + 1}`,
  email: `user${i + 1}@example.com`,
  password: 'test',
})) as UserAttributes[]

const mockRequests: IUserSpecialMembershipRequestAttributes[] = [
  generateMockUserSpecialMembershipRequest(1, mockUsers[0], mockSpecialMembershipAccesses[0], 'Request 1 for user 1'),
  generateMockUserSpecialMembershipRequest(2, mockUsers[0], mockSpecialMembershipAccesses[1], 'Request 2 for user 1'),
  generateMockUserSpecialMembershipRequest(3, mockUsers[1], mockSpecialMembershipAccesses[0], 'Request 1 for user 2'),
  generateMockUserSpecialMembershipRequest(4, mockUsers[2], mockSpecialMembershipAccesses[1], 'Request 1 for user 3'),
  generateMockUserSpecialMembershipRequest(
    5,
    mockUsers[3],
    MockSubscriptionWithRevokableTemporaryAfterDays,
    'Request 1 for user 4'
  ),
]

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
    await userModel.bulkCreate(mockUsers as UserAttributes[])
    await specialMembershipAccessModel.bulkCreate(mockSpecialMembershipAccesses)
    await userSpecialMembershipRequestModel.bulkCreate(mockRequests)
  })

  describe('find', () => {
    it('should return empty results when no records exist', async () => {
      const result = await service.find()

      assert.ok(Array.isArray(result.data))
      assert.strictEqual(result.data.length, 0)
      assert.strictEqual(result.pagination.total, 0)
    })

    it('should return paginated results, only for the specified user', async () => {
      const result = await service.find({ query: { limit: 5, offset: 0 }, user: { id: 4 } })
      assert.strictEqual(result.data.length, 1, 'Expected 1 result, but got ' + result.data.length)
      assert.strictEqual(result.pagination.total, 1)
      // should have the specialMembershipAccess included
      assert.ok(result.data[0].specialMembershipAccess)
      assert.strictEqual(result.data[0].userId, 4)
      assert.strictEqual(result.data[0].specialMembershipAccess?.id, MockSubscriptionWithRevokableTemporaryAfterDays.id) // subscription id for user 4
    })
  })

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
          isTemporary: false,
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
      assert.strictEqual(result.temporaryExpiresAt, null)
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

    it('should successfully create a temporary request when isTemporary is true', async () => {
      const now = new Date()
      const result = await service.create(
        {
          specialMembershipAccessId: MockSubscriptionWithRevokableTemporaryAfterDays.id,
          notes: 'Please approve this temporary access.',
          isTemporary: true,
        },
        { user: { id: 3 } }
      )

      assert.strictEqual(result.userId, 3)
      assert.strictEqual(result.specialMembershipAccessId, MockSubscriptionWithRevokableTemporaryAfterDays.id)
      assert.strictEqual(result.status, StatusPendingTemporary)
      assert.ok(result.dateCreated >= now)
      assert.ok(result.dateLastModified >= now)
      assert.ok(Array.isArray(result.changelog))
      assert.strictEqual(result.changelog.length, 1)
      assert.strictEqual(result.changelog[0].status, StatusPendingTemporary)
      assert.strictEqual(result.changelog[0].subscription, MockSubscriptionWithRevokableTemporaryAfterDays.title)
      assert.strictEqual(result.changelog[0].notes, 'Please approve this temporary access.')
      assert.ok(
        result.temporaryExpiresAt instanceof Date,
        'temporaryExpiresAt should be a Date, current value: ' +
          MockSubscriptionWithRevokableTemporaryAfterDays.metadata?.revokeTemporaryAutomaticApprovalAfterDays
      )
      assert.ok(result.temporaryExpiresAt!.getTime() > now.getTime())
    })

    it('should successfully create a request revokable after days when isTemporary is false', async () => {
      const now = new Date()
      const result = await service.create(
        {
          specialMembershipAccessId: MockSubscriptionWithRevokableAfterDays.id,
          notes: 'Please approve this temporary access, even if it is not temporary.',
          isTemporary: false,
        },
        { user: { id: 3 } }
      )

      assert.strictEqual(result.userId, 3)
      assert.strictEqual(result.specialMembershipAccessId, MockSubscriptionWithRevokableAfterDays.id)
      assert.strictEqual(result.status, StatusPending)
      assert.ok(result.dateCreated >= now)
      assert.ok(result.dateLastModified >= now)
      assert.ok(Array.isArray(result.changelog))
      assert.strictEqual(result.changelog.length, 1)
      assert.strictEqual(result.changelog[0].status, StatusPending)
      assert.strictEqual(result.changelog[0].subscription, MockSubscriptionWithRevokableAfterDays.title)
      assert.strictEqual(
        result.changelog[0].notes,
        'Please approve this temporary access, even if it is not temporary.'
      )
      assert.strictEqual(
        result.temporaryExpiresAt instanceof Date,
        false,
        'temporaryExpiresAt should be null when enableTemporaryAutomaticApproval is false'
      )
    })

    it('should throw BadRequest when temporary requests are not enabled for the subscription', async () => {
      await assert.rejects(
        async () =>
          service.create(
            {
              specialMembershipAccessId: 1,
              notes: 'Please approve this temporary access.',
              isTemporary: true,
            },
            { user: { id: 3 } }
          ),
        (error: any) => {
          assert.ok(error instanceof BadRequest)
          assert.strictEqual(
            error.message,
            'Temporary automatic acceptance is not enabled for this Special Membership Access'
          )
          return true
        }
      )
    })
  })
})
