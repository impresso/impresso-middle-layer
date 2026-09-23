import { strict as assert } from 'assert'
import { PagesService } from '@/services/pages/pages.class.js'
import Page from '@/models/pages.model.js'
import { setupTestApp, withDatabase, withSolr } from '../../../helpers/app.js'

type DbPage = {
  id: string
  issue_id: string | null
  num: number
  hasCoords: number
  hasErrors: number
  iiif: string
}

const mockPages: DbPage[] = Array.from({ length: 6 }, (_, i) => ({
  id: `GDL-1900-01-01-a-p${String(i + 1).padStart(4, '0')}`,
  issue_id: null,
  num: i + 1,
  hasCoords: 0,
  hasErrors: 0,
  iiif: `https://example.org/iiif/${i + 1}`,
}))

describe('PagesService', () => {
  let testApp: Awaited<ReturnType<typeof setupTestApp<[ReturnType<typeof withDatabase>]>>>
  let service: PagesService
  let pageModel: ReturnType<typeof Page.sequelize>

  before(async () => {
    testApp = setupTestApp(withDatabase(), withSolr())
    pageModel = Page.sequelize(testApp.sequelize)
    await testApp.sequelize.sync({ force: true })
    service = new PagesService(testApp.app)
  })

  after(async () => {
    await testApp.teardown()
  })

  beforeEach(async () => {
    await testApp.sequelize.truncate({ cascade: true })
  })

  describe('find', () => {
    it('returns correctly paginated rows from db mock data', async () => {
      await pageModel.bulkCreate(mockPages as any[])
      const result = await service.find({ query: { limit: 2, offset: 1 } })
      assert.ok(Array.isArray(result.data))
      assert.strictEqual(result.data.length, 2)
      assert.strictEqual(result.pagination.total, mockPages.length)
      assert.strictEqual(result.pagination.limit, 2)
      assert.strictEqual(result.pagination.offset, 1)
    })

    it('returns empty result with default pagination when no rows exist', async () => {
      const result = await service.find()
      assert.deepStrictEqual(result.data, [])
      assert.strictEqual(result.pagination.total, 0)
      assert.strictEqual(result.pagination.limit, 10)
      assert.strictEqual(result.pagination.offset, 0)
    })
  })
})
