import { Job } from 'bullmq'
import { ImpressoApplication } from '../../types'
import { logger } from '../../logger'

export const JobNameAddItemsToCollection = 'addItemsToCollection'

export interface AddItemsToCollectionJobData {
  userId: string
  collectionId: string
  itemIds: string[]
}

type AddItemsToCollectionJob = Job<AddItemsToCollectionJobData, undefined, typeof JobNameAddItemsToCollection>

export const createJobHandler = (app: ImpressoApplication) => {
  return async (job: AddItemsToCollectionJob) => {
    logger.info(`😊 Processing job ${job.id} ${job.name} to add items to collection: ${JSON.stringify(job.data)} `)
    return undefined
  }
}
