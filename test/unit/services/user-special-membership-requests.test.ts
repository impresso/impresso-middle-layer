import { strict as assert } from 'assert'
import { Sequelize } from 'sequelize'
import { NotFound } from '@feathersjs/errors'
import { UserSpecialMembershipRequestService } from '../../../src/services/user-special-membership-requests/user-special-membership-requests.class'
import UserSpecialMembershipRequest, {
  IUserSpecialMembershipRequestAttributes,
} from '../../../src/models/user-special-membership-requests.model'

import User from '../../../src/models/users.model'
import type { ImpressoApplication } from '../../../src/types'
import SpecialMembershipAccess, {
  ISpecialMembershipAccessAttributes,
} from '../../../src/models/special-membership-access.model'

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
    },
  ],
}))

// ---------------------------------------------------------

describe('UserSpecialMembershipRequestService', () => {
  let service: UserSpecialMembershipRequestService
  let sequelize: Sequelize

  let RequestModel: ReturnType<typeof UserSpecialMembershipRequest.initialize>
  let UserModel: ReturnType<typeof User.sequelize>
  let SubscriptionModel: ReturnType<typeof SpecialMembershipAccess.initialize>

  before(async () => {
    sequelize = new Sequelize({
      dialect: 'sqlite',
      storage: ':memory:',
      logging: false,
      define: {
        timestamps: false,
      },
    })

    // Initialize related models FIRST
    UserModel = User.sequelize(sequelize)
    SubscriptionModel = SpecialMembershipAccess.initialize(sequelize)

    // Initialize request model LAST (it depends on the others)
    RequestModel = UserSpecialMembershipRequest.initialize(sequelize)

    await sequelize.sync({ force: true })

    // Mock Feathers app
    const app = {
      get: (key: string) => (key === 'sequelizeClient' ? sequelize : undefined),
    } as ImpressoApplication

    service = new UserSpecialMembershipRequestService(app)

    // Insert related mock data
    await SubscriptionModel.bulkCreate(mockSubscriptions)
    await UserModel.bulkCreate(mockUsers as any)
  })

  after(async () => {
    await sequelize.close()
  })

  beforeEach(async () => {
    await RequestModel.destroy({ where: {}, truncate: true })
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
      await RequestModel.bulkCreate(mockRequests)
      const result = await service.find({ query: { limit: 5, offset: 0 }, user: { id: 15 } })
      console.log(result.data[0])
      assert.strictEqual(result.data.length, 1)
      assert.strictEqual(result.pagination.total, 1)
    })
  })

  // ---------------------------------------------------------
  // GET TESTS
  // ---------------------------------------------------------
  describe('get', () => {
    it('should retrieve a record by id', async () => {
      await RequestModel.create(mockRequests[0])

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
})
