import { Job } from 'bullmq'
import { ImpressoApplication } from '@/types.js'
import { logger } from '@/logger.js'
import { BulkDeleteRequest } from '@/internalServices/simpleSolr.js'
import { SolrNamespaces } from '@/solr.js'
import { CollectionIndexVersion } from '@/services/search-facets/search-facets.class.js'

export const JobNameRemoveItemsFromCollection = 'removeItemsToCollection'

export interface RemoveItemsFromCollectionJobData {
  userId: string
  collectionId: string
  itemIds: string[]
}

type RemoveItemsFromCollectionJob = Job<
  RemoveItemsFromCollectionJobData,
  undefined,
  typeof JobNameRemoveItemsFromCollection
>

const requestToPayload = (
  data: RemoveItemsFromCollectionJobData,
  collectionsIndexVersion: CollectionIndexVersion
): BulkDeleteRequest => {
  const { userId, collectionId, itemIds } = data
  const col_id_s = `${userId}_${collectionId}`

  const items: string[] = itemIds.map(ci_id_s => {
    return collectionsIndexVersion === 'new' ? `${ci_id_s}!${col_id_s}` : `${col_id_s}|${ci_id_s}`
  })

  return {
    delete: items,
  }
}

export const createJobHandler = (app: ImpressoApplication) => {
  return async (job: RemoveItemsFromCollectionJob) => {
    logger.info(
      `⬅️ 📚 Processing job ${job.id} ${job.name} to remove items from collection: ${JSON.stringify(job.data)} `
    )
    await removeItemsFromCollection(app, job.data)
    logger.info(
      `⬅️ 📚 Finished processing job ${job.id} ${job.name} to remove items from collection: ${JSON.stringify(job.data)} `
    )

    return undefined
  }
}

export const removeItemsFromCollection = async (
  app: ImpressoApplication,
  jobData: RemoveItemsFromCollectionJobData
) => {
  const solrClient = app.service('simpleSolrClient')
  const collectionsIndexVersion = app.get('features')?.collectionsIndexVersion ?? 'legacy'
  await solrClient.sendBulkUpdateRequest(
    SolrNamespaces.CollectionItems,
    requestToPayload(jobData, collectionsIndexVersion),
    true
  )
}
