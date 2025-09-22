import { Job } from 'bullmq'
import { ImpressoApplication } from '../../types'
import { logger } from '../../logger'

export const JobNameAddItemsToCollection = 'addItemsToCollection'

export interface AddItemsToCollectionJob {
  userId: string
  collectionId: string
  itemIds: string[]
}

export const createJobHandler = (app: ImpressoApplication) => {
  return async (job: Job<AddItemsToCollectionJob, undefined, typeof JobNameAddItemsToCollection>) => {
    logger.info(`Processing job ${job.id} to add items to collection: ${JSON.stringify(job.data)}`)
    return undefined
  }
}
