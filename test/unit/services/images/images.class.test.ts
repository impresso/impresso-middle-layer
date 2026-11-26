import { strict as assert } from 'assert'
import { Images, OrderByChoices } from '@/services/images/images.class.js'
import { setupTestApp, withSolr } from '../../../helpers/app.js'

describe('Images', () => {
  let testApp: ReturnType<typeof setupTestApp<[ReturnType<typeof withSolr>]>>
  let images: Images

  before(() => {
    testApp = setupTestApp(withSolr())
    images = new Images(testApp.app, testApp.app.service('simpleSolrClient'), testApp.app.service('media-sources'), [])
  })

  after(async () => {
    await testApp.teardown()
  })

  beforeEach(() => {
    testApp.solrSelectCalls.length = 0
  })

  describe('order_by', () => {
    it('exposes readingOrder choices', () => {
      assert.ok(OrderByChoices.includes('readingOrder'))
      assert.ok(OrderByChoices.includes('-readingOrder'))
    })

    it('sorts by reading_order_i ascending', async () => {
      await images.find({ query: { order_by: 'readingOrder' } })
      assert.equal(testApp.solrSelectCalls[0].sort, 'reading_order_i asc')
    })

    it('sorts by reading_order_i descending', async () => {
      await images.find({ query: { order_by: '-readingOrder' } })
      assert.equal(testApp.solrSelectCalls[0].sort, 'reading_order_i desc')
    })

    it('does not send a sort when order_by is missing', async () => {
      await images.find({ query: {} })
      assert.equal(testApp.solrSelectCalls[0].sort, undefined)
    })
  })

  describe('issue filter', () => {
    it('translates an issue filter into a meta_issue_id_s Solr filter', async () => {
      await images.find({ query: { filters: [{ type: 'issue', q: ['GDL-1900-01-01-a'] }] } })

      const serialized = JSON.stringify(testApp.solrSelectCalls[0].filter)
      assert.ok(serialized.includes('meta_issue_id_s'), serialized)
      assert.ok(serialized.includes('GDL-1900-01-01-a'), serialized)
    })
  })
})
