import { Job } from 'bullmq'
import { ImpressoApplication } from '../../types'
import { logger } from '../../logger'
import { BulkDeleteRequest } from '../../internalServices/simpleSolr'
import { SolrNamespaces } from '../../solr'

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

const requestToPayload = (job: RemoveItemsFromCollectionJob): BulkDeleteRequest => {
  const { userId, collectionId, itemIds } = job.data
  const col_id_s = `${userId}_${collectionId}`

  const items: string[] = itemIds.map(ci_id_s => {
    return `${col_id_s}|${ci_id_s}`
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
    const solrClient = app.service('simpleSolrClient')
    await solrClient.sendBulkUpdateRequest(SolrNamespaces.CollectionItems, requestToPayload(job), true)
    logger.info(
      `⬅️ 📚 Finished processing job ${job.id} ${job.name} to remove items from collection: ${JSON.stringify(job.data)} `
    )

    return undefined
  }
}
