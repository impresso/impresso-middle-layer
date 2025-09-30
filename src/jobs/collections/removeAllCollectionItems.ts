import { Job } from 'bullmq'
import { ImpressoApplication } from '../../types'
import { logger } from '../../logger'
import { SolrNamespaces } from '../../solr'
import { DeleteRequest } from '../../internalServices/simpleSolr'

export const JobNameRemoveAllCollectionItems = 'removeAllCollectionItems'

export interface RemoveAllCollectionItemsJobData {
  userId: string
  collectionId: string
}

type RemoveAllCollectionItemsJob = Job<
  RemoveAllCollectionItemsJobData,
  undefined,
  typeof JobNameRemoveAllCollectionItems
>

const requestToPayload = (job: RemoveAllCollectionItemsJob): DeleteRequest => {
  const { userId, collectionId } = job.data
  const col_id_s = `${userId}_${collectionId}`

  return {
    delete: {
      query: `col_id_s:${col_id_s}`,
    },
  }
}

export const createJobHandler = (app: ImpressoApplication) => {
  return async (job: RemoveAllCollectionItemsJob) => {
    logger.info(
      `❌ 📚 Processing job ${job.id} ${job.name} to remove all items from collection: ${JSON.stringify(job.data)} `
    )
    const solrClient = app.service('simpleSolrClient')
    await solrClient.sendDeleteRequest(SolrNamespaces.CollectionItems, requestToPayload(job), true)
    logger.info(
      `❌ 📚 Finished processing job ${job.id} ${job.name} to remove all items from collection: ${JSON.stringify(job.data)} `
    )

    return undefined
  }
}
