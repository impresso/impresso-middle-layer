import { Job } from 'bullmq'
import { ImpressoApplication } from '@/types.js'
import { logger } from '@/logger.js'
import { SolrNamespace } from '@/solr.js'
import { Filter } from 'impresso-jscommons'
import { buildSolrQuery } from '@/util/solr/queryBuilder.js'

export const JobNameAddQueryResultItemsToCollection = 'addQueryResultItemsToCollection'

export interface AddQueryResultItemsToCollectionJobData {
  userId: string
  collectionId: string
  solrNamespace: Extract<SolrNamespace, 'search' | 'tr_passages'>
  filters: Filter[]
  queryLimit?: number
}

type AddQueryResultItemsToCollectionJob = Job<
  AddQueryResultItemsToCollectionJobData,
  undefined,
  typeof JobNameAddQueryResultItemsToCollection
>

const DefaultQueryHardLimit = 100000
const PageSize = 1000

export const createJobHandler = (app: ImpressoApplication) => {
  return async (job: AddQueryResultItemsToCollectionJob) => {
    logger.info(
      `🔍 ➡️ 📚 Processing job ${job.id} ${job.name} to add query result items to collection: ${JSON.stringify(job.data)} `
    )

    const { filters, solrNamespace } = job.data

    const { query, filter, params } = buildSolrQuery(
      filters,
      solrNamespace,
      app.get('solrConfiguration').namespaces ?? [],
      app.get('features') ?? {}
    )

    const solrClient = app.service('simpleSolrClient')
    const queueService = app.service('queueService')

    const queryLimit = job.data.queryLimit ?? DefaultQueryHardLimit

    const baseRequestBody = {
      fields: 'id',
      query,
      filter,
      // `cursorMark` requires a deterministic total ordering, so the sort must end on a
      // unique field. Order is irrelevant here (every match is added to the collection),
      // so sorting by `id` alone is both sufficient and the cheapest option for Solr.
      sort: 'id asc',
      params: {
        hl: false,
        ...params,
      },
    }

    // Probe the result size before paging. Previously the limit was checked on every
    // page, which meant an over-sized query still paid for a full 1000-document fetch
    // before aborting. A `limit: 0` request returns `numFound` without any documents.
    const probeResult = await solrClient.select(solrNamespace, {
      body: { ...baseRequestBody, limit: 0 },
    })
    const numFound = probeResult.response?.numFound ?? 0
    if (numFound > queryLimit) {
      logger.error(
        `❌ ➡️ 📚 Aborting job ${job.id} ${job.name} to add query result items to collection: ${JSON.stringify(
          job.data
        )} because the number of matching items (${numFound}) exceeds the limit (${queryLimit})`
      )
      return undefined
    }

    // Page with `cursorMark` rather than a numeric offset. Deep offsets force Solr to
    // rank and discard every preceding document on each request, which gets expensive
    // near the 100k hard limit; a cursor is O(page size) regardless of depth. It is
    // also immune to the double-increment class of paging bug, since the position is
    // carried by the server-supplied token instead of arithmetic on our side.
    let cursorMark = '*'
    let totalSubjobs = 0
    let totalItems = 0

    while (totalItems < queryLimit) {
      const result = await solrClient.select(solrNamespace, {
        body: {
          ...baseRequestBody,
          limit: PageSize,
          params: { ...baseRequestBody.params, cursorMark },
        },
      })

      const docs = result.response?.docs ?? []
      const ids = docs.map(d => d.id) as string[]

      if (ids.length > 0) {
        await queueService.addItemsToCollection({
          userId: job.data.userId,
          collectionId: job.data.collectionId,
          itemIds: ids,
        })
        totalSubjobs++
        totalItems += ids.length
      }

      // Solr signals the end of the result set by echoing back the cursor mark that
      // was sent. Guard on a missing token too so a malformed response cannot loop
      // forever on the same page.
      const nextCursorMark = result.nextCursorMark
      if (nextCursorMark == null || nextCursorMark === cursorMark) break
      cursorMark = nextCursorMark
    }

    logger.info(
      `🔍 ➡️ 📚 Finished processing job ${job.id} ${job.name} to add query result items to collection: ${JSON.stringify(job.data)}. ` +
        `Published ${totalSubjobs} jobs to add all ${totalItems} matching items to the collection.`
    )

    return undefined
  }
}
