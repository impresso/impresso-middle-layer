import { strict as assert } from 'assert'
import { addItemsToCollection } from '@/jobs/collections/addItemsToCollection.js'
import { setupTestApp, withSolr, type TestAppFeature } from '../../../helpers/app.js'
import { SolrNamespaces } from '@/solr.js'

const withCollectionsStatus = (status?: string): TestAppFeature => ctx => {
  ctx.serviceHandlers['collections'] = () => ({
    getInternal: async () => (status == null ? undefined : ({ status } as any)),
  })
}

const setupJobApp = (status?: string) => setupTestApp(withSolr(), withCollectionsStatus(status))

describe('addItemsToCollection job', () => {
  const jobData = {
    userId: '1',
    collectionId: 'coll1',
    itemIds: ['ci1', 'ci2'],
  }

  const captureBulkUpdates = async (testApp: ReturnType<typeof setupJobApp>) => {
    const requests: { namespace: string; request: Record<string, any>; commit: boolean }[] = []
    ;(testApp.mockSolr as any).sendBulkUpdateRequest = async (
      namespace: string,
      request: Record<string, any>,
      commit: boolean
    ) => {
      requests.push({ namespace, request, commit })
      return {}
    }
    return requests
  }

  it('writes items as public when the collection status is PUB', async () => {
    const testApp = setupJobApp('PUB')
    const requests = await captureBulkUpdates(testApp)

    await addItemsToCollection(testApp.app, jobData)

    assert.strictEqual(requests.length, 1)
    assert.strictEqual(requests[0].namespace, SolrNamespaces.CollectionItems)
    assert.strictEqual(requests[0].commit, true)
    assert.deepStrictEqual(requests[0].request.add, [
      { id: '1_coll1|ci1', ci_id_s: 'ci1', col_id_s: '1_coll1', vis_s: 'pub' },
      { id: '1_coll1|ci2', ci_id_s: 'ci2', col_id_s: '1_coll1', vis_s: 'pub' },
    ])
    await testApp.teardown()
  })

  it('writes items as public when the collection status is SHA', async () => {
    const testApp = setupJobApp('SHA')
    const requests = await captureBulkUpdates(testApp)

    await addItemsToCollection(testApp.app, jobData)

    assert.ok(requests[0].request.add.every((item: any) => item.vis_s === 'pub'))
    await testApp.teardown()
  })

  it('writes items as private when the collection status is PRI', async () => {
    const testApp = setupJobApp('PRI')
    const requests = await captureBulkUpdates(testApp)

    await addItemsToCollection(testApp.app, jobData)

    assert.ok(requests[0].request.add.every((item: any) => item.vis_s === 'pri'))
    await testApp.teardown()
  })

  it('fails safe to private when the collection is not found', async () => {
    const testApp = setupJobApp(undefined)
    const requests = await captureBulkUpdates(testApp)

    await addItemsToCollection(testApp.app, jobData)

    assert.ok(requests[0].request.add.every((item: any) => item.vis_s === 'pri'))
    await testApp.teardown()
  })
})
