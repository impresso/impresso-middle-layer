import { Job } from 'bullmq'
import { logger } from '../../logger'
import { CollectionItem } from '../../models/generated/solr'
import { SolrNamespaces } from '../../solr'
import { ImpressoApplication } from '../../types'
import { BulkAddRequest } from '../../internalServices/simpleSolr'

export const JobNameAddItemsToCollection = 'addItemsToCollection'

export interface AddItemsToCollectionJobData {
  userId: string
  collectionId: string
  itemIds: string[]
}

type AddItemsToCollectionJob = Job<AddItemsToCollectionJobData, undefined, typeof JobNameAddItemsToCollection>

const requestToPayload = (job: AddItemsToCollectionJob): BulkAddRequest<CollectionItem> => {
  const { userId, collectionId, itemIds } = job.data
  const col_id_s = `${userId}_${collectionId}`

  const items: CollectionItem[] = itemIds.map(ci_id_s => {
    return {
      id: `${col_id_s}|${ci_id_s}`,
      ci_id_s,
      col_id_s,
      vis_s: 'pri',
    }
  })

  return {
    add: items,
  }
}

export const createJobHandler = (app: ImpressoApplication) => {
  return async (job: AddItemsToCollectionJob) => {
    logger.info(`➡️ 📚 Processing job ${job.id} ${job.name} to add items to collection: ${JSON.stringify(job.data)} `)
    const solrClient = app.service('simpleSolrClient')

    await solrClient.sendBulkUpdateRequest(SolrNamespaces.CollectionItems, requestToPayload(job), true)
    logger.info(
      `➡️ 📚 Finished processing job ${job.id} ${job.name} to add items to collection: ${JSON.stringify(job.data)} `
    )

    return undefined
  }
}
