import { Job } from 'bullmq'
import { ImpressoApplication } from '../../types'
import { logger } from '../../logger'

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

export const createJobHandler = (app: ImpressoApplication) => {
  return async (job: RemoveAllCollectionItemsJob) => {
    logger.info(
      `😊 Processing job ${job.id} ${job.name} to remove all items from collection: ${JSON.stringify(job.data)} `
    )
    return undefined
  }
}
