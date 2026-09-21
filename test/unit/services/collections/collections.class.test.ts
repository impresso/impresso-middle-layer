import { strict as assert } from 'assert'
import { CollectionsService } from '@/services/collections/collections.class.js'
import { Service as UsersService } from '@/services/users/users.class.js'
import {
  setupTestApp,
  withConfig,
  withDatabase,
  withQueueService,
  withRedisCelery,
  withSolr,
} from '../../../helpers/app.js'
import User from '@/models/users.model.js'
import UserCollection from '@/models/user-collection.js'

const mockUser1 = {
  uid: 'user1',
  id: 1,
  username: 'local-1',
  firstname: 'First 1',
  lastname: 'Last 1',
  email: 'user1@example.com',
  password: 'test',
}

const mockUser2 = {
  uid: 'user2',
  id: 2,
  username: 'local-2',
  firstname: 'First 2',
  lastname: 'Last 2',
  email: 'user2@example.com',
  password: 'test',
}

const mockCollectionForUser1 = {
  id: 'coll1',
  creatorId: mockUser1.id,
  name: 'Collection 1',
  description: 'Description for collection 1',
  status: 'PRI',
  creationDate: new Date('2026-01-01T00:00:00Z'),
  lastModifiedDate: new Date('2026-08-02T00:00:00Z'),
}

const mockCollectionForUser2 = {
  id: 'coll2',
  creatorId: mockUser2.id,
  name: 'Collection 2',
  description: 'Description for collection 2',
  status: 'PRI',
  creationDate: new Date('2026-02-01T00:00:00Z'),
  lastModifiedDate: new Date('2026-08-03T00:00:00Z'),
}

const mockCollections = [mockCollectionForUser1, mockCollectionForUser2]

describe('CollectionsService', () => {
  let testApp: ReturnType<
    typeof setupTestApp<
      [
        ReturnType<typeof withDatabase>,
        ReturnType<typeof withRedisCelery>,
        ReturnType<typeof withSolr>,
        ReturnType<typeof withQueueService>,
      ]
    >
  >
  let userModel: ReturnType<typeof User.sequelize>
  let userCollectionModel: ReturnType<typeof UserCollection.initialize>
  let service: CollectionsService

  before(async () => {
    testApp = setupTestApp(withDatabase(), withRedisCelery(), withSolr(), withQueueService())
    userModel = User.sequelize(testApp.sequelize)
    userCollectionModel = UserCollection.initialize(testApp.sequelize)
    await testApp.sequelize.sync({ force: true })
    service = new CollectionsService(testApp.app)
  })

  after(async () => {
    await testApp.teardown()
  })

  beforeEach(async () => {
    await testApp.sequelize.truncate({ cascade: true })
  })

  describe('find', () => {
    it('returns the authenticated user collections with item counts from Solr', async () => {
      // create the collection in the database for user1
      await userModel.create(mockUser1 as any)
      await userModel.create(mockUser2 as any)
      await userCollectionModel.bulkCreate([mockCollectionForUser1 as any, mockCollectionForUser2 as any])
      const slimUser = { id: mockUser1.id, uid: mockUser1.uid } as any

      // mock the Solr facet response used to compute `totalItems` for the created collection
      testApp.mockSolr.select = async () => ({
        response: { docs: [], numFound: 0 },
        facets: {
          collections: {
            buckets: [
              { val: `${mockUser1.id}_${mockCollectionForUser1.id}`, count: 5 },
              { val: `${mockUser2.id}_${mockCollectionForUser2.id}`, count: 3 },
            ],
          },
        },
      })

      const result = await service.find({ query: {}, user: slimUser })
      console.log('result:', result) // Log the result for debugging
      assert.strictEqual(result.pagination.total, 1)
      assert.strictEqual(result.data.length, 1)
      assert.strictEqual(result.data[0].id, mockCollectionForUser1.id)
      assert.strictEqual(result.data[0].description, mockCollectionForUser1.description)
      assert.strictEqual(result.data[0].totalItems, 5)
      // user 1 is assigned to collection 1, so it should not be any collection 2
      const result2 = await service.find({ query: { term: 'Collection 2' }, user: slimUser })
      assert.strictEqual(result2.pagination.total, 0)
      assert.strictEqual(result2.data.length, 0)

      // get collection 2 for user2
      const slimUser2 = { id: mockUser2.id, uid: mockUser2.uid } as any
      const result3 = await service.find({ query: {}, user: slimUser2 })
      assert.strictEqual(result3.pagination.total, 1)
      assert.strictEqual(result3.data.length, 1)
      assert.strictEqual(result3.data[0].id, mockCollectionForUser2.id)
      assert.strictEqual(result3.data[0].description, mockCollectionForUser2.description)
      assert.strictEqual(result3.data[0].totalItems, 3)

      // search for user 2 collection 2
      const result4 = await service.find({ query: { term: 'Collection 2' }, user: slimUser2 })
      assert.strictEqual(result4.pagination.total, 1)
      assert.strictEqual(result4.data.length, 1)
      assert.strictEqual(result4.data[0].id, mockCollectionForUser2.id)
      assert.strictEqual(result4.data[0].description, mockCollectionForUser2.description)
      assert.strictEqual(result4.data[0].totalItems, 3)
    })

    it('returns an empty result when no user is authenticated', async () => {
      const result = await service.find({ query: {} } as any)
      assert.deepStrictEqual(result, { data: [], pagination: { limit: 10, offset: 0, total: 0 } })
    })
  })
})
