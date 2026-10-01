import { strict as assert } from 'assert'
import {
  createJobHandler,
  JobNameUpdateCollectionItemsVisibility,
  UpdateCollectionItemsVisibilityJobData,
} from '@/jobs/collections/updateCollectionItemsVisibility.js'
import { setupTestApp, withSolr } from '../../../helpers/app.js'
import { SolrNamespaces } from '@/solr.js'

describe('updateCollectionItemsVisibility job', () => {
  let testApp: ReturnType<typeof setupTestApp<[ReturnType<typeof withSolr>]>>
  let selectCalls: Record<string, any>[]
  let selectNamespaces: string[]
  let updateRequests: { namespace: string; request: Record<string, any>; commit: boolean }[]

  const jobData: UpdateCollectionItemsVisibilityJobData = {
    userId: '1',
    collectionId: 'coll1',
    visibility: 'pub',
  }

  before(async () => {
    testApp = setupTestApp(withSolr())
  })

  after(async () => {
    await testApp.teardown()
  })

  beforeEach(() => {
    selectCalls = []
    selectNamespaces = []
    updateRequests = []

    testApp.mockSolr.select = async (namespace: string, { body }: { body: Record<string, any> }) => {
      selectNamespaces.push(namespace)
      selectCalls.push(body)
      return { response: { numFound: 0, docs: [] }, nextCursorMark: '*' }
    }
    ;(testApp.mockSolr as any).sendBulkUpdateRequest = async (
      namespace: string,
      request: Record<string, any>,
      commit: boolean
    ) => {
      updateRequests.push({ namespace, request, commit })
      return {}
    }
  })

  it('pages through all collection items and updates their visibility with atomic updates', async () => {
    testApp.mockSolr.select = async (_namespace: string, { body }: { body: Record<string, any> }) => {
      selectCalls.push(body)
      const isFirstPage = selectCalls.length === 2
      return {
        response: {
          numFound: 3,
          docs: isFirstPage ? [{ id: 'ci1!1_coll1' }, { id: 'ci2!1_coll1' }] : [{ id: 'ci3!1_coll1' }],
        },
        nextCursorMark: 'cursor-2',
      }
    }

    const handler = createJobHandler(testApp.app)
    await handler({ id: 'job-1', name: JobNameUpdateCollectionItemsVisibility, data: jobData } as any)

    // probe (limit 0) + page 1 + page 2
    assert.strictEqual(selectCalls.length, 3)
    const [probe, firstPage, secondPage] = selectCalls
    assert.strictEqual(probe.limit, 0)
    assert.strictEqual(probe.query, 'col_id_s:1_coll1')
    assert.strictEqual(probe.fields, 'id')
    assert.strictEqual(probe.sort, 'id asc')
    assert.strictEqual(firstPage.limit, 1000)
    assert.strictEqual(firstPage.params.cursorMark, '*')
    assert.strictEqual(secondPage.params.cursorMark, 'cursor-2')

    assert.strictEqual(updateRequests.length, 2)
    for (const update of updateRequests) {
      assert.strictEqual(update.namespace, SolrNamespaces.CollectionItems)
      assert.strictEqual(update.commit, true)
    }
    assert.deepStrictEqual(updateRequests[0].request.add, [
      { id: 'ci1!1_coll1', vis_s: { set: 'pub' } },
      { id: 'ci2!1_coll1', vis_s: { set: 'pub' } },
    ])
    assert.deepStrictEqual(updateRequests[1].request.add, [{ id: 'ci3!1_coll1', vis_s: { set: 'pub' } }])
  })

  it('issues no update when the collection has no items', async () => {
    const handler = createJobHandler(testApp.app)
    await handler({ id: 'job-2', name: JobNameUpdateCollectionItemsVisibility, data: jobData } as any)

    assert.strictEqual(selectCalls.length, 1)
    assert.strictEqual(updateRequests.length, 0)
  })

  it('stops paging when Solr does not echo the cursor mark', async () => {
    testApp.mockSolr.select = async (_namespace: string, { body }: { body: Record<string, any> }) => {
      selectCalls.push(body)
      return {
        response: { numFound: 2, docs: [{ id: 'ci1!1_coll1' }] },
        // missing nextCursorMark on purpose
      }
    }

    const handler = createJobHandler(testApp.app)
    await handler({ id: 'job-3', name: JobNameUpdateCollectionItemsVisibility, data: jobData } as any)

    // a single page is processed, then the loop breaks instead of looping forever
    assert.strictEqual(selectCalls.length, 2)
    assert.strictEqual(updateRequests.length, 1)
  })

  it('aborts without updates when the collection exceeds the items hard limit', async () => {
    testApp.mockSolr.select = async (_namespace: string, { body }: { body: Record<string, any> }) => {
      selectCalls.push(body)
      return { response: { numFound: 100001, docs: [] }, nextCursorMark: '*' }
    }

    const handler = createJobHandler(testApp.app)
    await handler({ id: 'job-4', name: JobNameUpdateCollectionItemsVisibility, data: jobData } as any)

    // only the limit: 0 probe ran; no paging, no Solr updates
    assert.strictEqual(selectCalls.length, 1)
    assert.strictEqual(updateRequests.length, 0)
  })

  it('uses the collection_items Solr namespace', async () => {
    const handler = createJobHandler(testApp.app)
    await handler({ id: 'job-5', name: JobNameUpdateCollectionItemsVisibility, data: jobData } as any)

    assert.deepStrictEqual(selectNamespaces, [SolrNamespaces.CollectionItems])
  })
})
