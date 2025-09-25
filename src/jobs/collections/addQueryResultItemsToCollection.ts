import { Job } from 'bullmq'
import { ImpressoApplication } from '../../types'
import { logger } from '../../logger'
import { SolrNamespace } from '../../solr'
import { Filter } from 'impresso-jscommons'

export const JobNameAddQueryResultItemsToCollection = 'addQueryResultItemsToCollection'

export interface AddQueryResultItemsToCollectionJobData {
  userId: string
  collectionId: string
  solrNamespace: Extract<SolrNamespace, 'search' | 'tr_passages'>
  filters: Filter[]
}

type AddQueryResultItemsToCollectionJob = Job<
  AddQueryResultItemsToCollectionJobData,
  undefined,
  typeof JobNameAddQueryResultItemsToCollection
>

export const createJobHandler = (app: ImpressoApplication) => {
  return async (job: AddQueryResultItemsToCollectionJob) => {
    logger.info(
      `😊 Processing job ${job.id} ${job.name} to add query result items to collection: ${JSON.stringify(job.data)} `
    )
    return undefined
  }
}
