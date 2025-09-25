import { Job } from 'bullmq'
import { ImpressoApplication } from '../../types'
import { logger } from '../../logger'

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

export const createJobHandler = (app: ImpressoApplication) => {
  return async (job: RemoveItemsFromCollectionJob) => {
    logger.info(`😊 Processing job ${job.id} ${job.name} to remove items from collection: ${JSON.stringify(job.data)} `)
    return undefined
  }
}
