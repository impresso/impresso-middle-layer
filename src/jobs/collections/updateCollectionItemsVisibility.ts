import { Job } from 'bullmq'
import { ImpressoApplication } from '@/types.js'
import { logger } from '@/logger.js'
import { SolrNamespaces } from '@/solr.js'

export const JobNameUpdateCollectionItemsVisibility = 'updateCollectionItemsVisibility'

export interface UpdateCollectionItemsVisibilityJobData {
  userId: string
  collectionId: string
  visibility: 'pub' | 'pri'
}

type UpdateCollectionItemsVisibilityJob = Job<
  UpdateCollectionItemsVisibilityJobData,
  undefined,
  typeof JobNameUpdateCollectionItemsVisibility
>

interface AtomicVisibilityUpdate {
  id: string
  vis_s: { set: 'pub' | 'pri' }
}

const DefaultItemsHardLimit = 100000
const PageSize = 1000

export const updateCollectionItemsVisibility = async (
  app: ImpressoApplication,
  jobData: UpdateCollectionItemsVisibilityJobData
): Promise<number> => {
  const solrClient = app.service('simpleSolrClient')
  const { userId, collectionId, visibility } = jobData
  const col_id_s = `${userId}_${collectionId}`

  const baseRequestBody = {
    query: `col_id_s:${col_id_s}`,
    fields: 'id',
    // `cursorMark` requires a deterministic total ordering, so the sort must end on a
    // unique field. `id` is unique and unaffected by the visibility update.
    sort: 'id asc',
  }

  // Probe the result size before paging. A `limit: 0` request returns `numFound`
  // without any documents. Oversized collections are aborted with an error instead
  // of being silently truncated, which would leave items with a stale visibility.
  const probeResult = await solrClient.select<{ id: string }>(SolrNamespaces.CollectionItems, {
    body: { ...baseRequestBody, limit: 0 },
  })
  const numFound = probeResult.response?.numFound ?? 0
  if (numFound > DefaultItemsHardLimit) {
    logger.error(
      `❌ 🔁 📚 Aborting visibility update for collection ${collectionId} (user ${userId}): ${numFound} items exceed the hard limit of ${DefaultItemsHardLimit}. No items were updated; visibility stays stale.`
    )
    return 0
  }

  let cursorMark = '*'
  let totalUpdated = 0

  while (totalUpdated < numFound) {
    const result = await solrClient.select<{ id: string }>(SolrNamespaces.CollectionItems, {
      body: {
        ...baseRequestBody,
        limit: PageSize,
        params: { cursorMark },
      },
    })

    const ids = (result.response?.docs ?? []).map(doc => doc.id).filter((id): id is string => id != null)

    if (ids.length > 0) {
      // Atomic updates via the `set` modifier: Solr re-reads each document and
      // rewrites it with the new visibility, preserving all other fields.
      await solrClient.sendBulkUpdateRequest<AtomicVisibilityUpdate>(
        SolrNamespaces.CollectionItems,
        {
          add: ids.map(id => ({
            id,
            vis_s: { set: visibility },
          })),
        },
        true
      )
      totalUpdated += ids.length
    }

    // Solr signals the end of the result set by echoing back the cursor mark that
    // was sent. Guard on a missing token too so a malformed response cannot loop
    // forever on the same page.
    const nextCursorMark = result.nextCursorMark
    if (nextCursorMark == null || nextCursorMark === cursorMark) break
    cursorMark = nextCursorMark
  }

  return totalUpdated
}

export const createJobHandler = (app: ImpressoApplication) => {
  return async (job: UpdateCollectionItemsVisibilityJob) => {
    logger.info(
      `🔁 📚 Processing job ${job.id} ${job.name} to update items visibility of collection: ${JSON.stringify(job.data)} `
    )
    const totalUpdated = await updateCollectionItemsVisibility(app, job.data)
    logger.info(
      `🔁 📚 Finished processing job ${job.id} ${job.name} to update items visibility of collection: ${JSON.stringify(
        job.data
      )}. Updated ${totalUpdated} items.`
    )

    return undefined
  }
}
