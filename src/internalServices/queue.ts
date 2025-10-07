import { Job as BullJob, Queue } from 'bullmq'
import IORedis from 'ioredis'
import { RedisConfiguration } from '../configuration'
import { AddItemsToCollectionJobData, JobNameAddItemsToCollection } from '../jobs/collections/addItemsToCollection'
import {
  AddQueryResultItemsToCollectionJobData,
  JobNameAddQueryResultItemsToCollection,
} from '../jobs/collections/addQueryResultItemsToCollection'
import { JobNameMigrateOldCollections, MigrateOldCollectionsJobData } from '../jobs/collections/migrateOldCollections'
import {
  JobNameRemoveAllCollectionItems,
  RemoveAllCollectionItemsJobData,
} from '../jobs/collections/removeAllCollectionItems'
import {
  JobNameRemoveItemsFromCollection,
  RemoveItemsFromCollectionJobData,
} from '../jobs/collections/removeItemsFromCollection'
import { ExportSearchResultsJobData, JobNameExportSearchResults } from '../jobs/searchResults/exportSearchResults'
import { logger } from '../logger'
import { ImpressoApplication } from '../types'
import { ensureServiceIsFeathersCompatible } from '../util/feathers'

export interface QueueServiceOptions {
  redisConfig: RedisConfiguration
}

/**
 * Queue service for managing collections operations using BullMQ
 */
export class QueueService {
  private queueAddItemsToCollection: Queue
  private queueRemoveItemsFromCollection: Queue
  private queueRemoveAllCollectionItems: Queue
  private queueAddQueryResultItemsToCollection: Queue
  private queueExportSearchResults: Queue
  private queueMigrateOldCollections: Queue

  private redisConfig: RedisConfiguration

  constructor(options: QueueServiceOptions) {
    this.redisConfig = options.redisConfig

    // Create Redis connection options for BullMQ
    const connectionOptions: any = {
      host: this.redisConfig.host || 'localhost',
      port: this.redisConfig.port || 6379,
    }
    logger.info('Starting queue service with redis:', this.redisConfig)

    if (this.redisConfig.password) {
      connectionOptions.password = this.redisConfig.password
    }

    if ((this.redisConfig as any).db) {
      connectionOptions.db = (this.redisConfig as any).db
    }

    const defaultJobOptions = {
      removeOnComplete: 10, // Keep last 10 completed jobs
      removeOnFail: 5, // Keep last 5 failed jobs
      attempts: 5, // Retry failed jobs up to 5 times
      backoff: {
        type: 'exponential',
        delay: 5000, // Start with 5 second delay, exponentially increase
      },
    }

    const connection = new IORedis({
      ...connectionOptions,
      maxRetriesPerRequest: null,
      enableReadyCheck: true,
    })

    this.queueAddItemsToCollection = new Queue(JobNameAddItemsToCollection, {
      defaultJobOptions,
      connection,
    })
    this.queueRemoveItemsFromCollection = new Queue(JobNameRemoveItemsFromCollection, {
      connection,
      defaultJobOptions,
    })
    this.queueRemoveAllCollectionItems = new Queue(JobNameRemoveAllCollectionItems, {
      connection,
      defaultJobOptions,
    })
    this.queueAddQueryResultItemsToCollection = new Queue(JobNameAddQueryResultItemsToCollection, {
      connection,
      defaultJobOptions,
    })
    this.queueExportSearchResults = new Queue(JobNameExportSearchResults, {
      connection,
      defaultJobOptions,
    })
    this.queueMigrateOldCollections = new Queue(JobNameMigrateOldCollections, {
      connection,
      defaultJobOptions,
    })
  }

  /**
   * Add items to a user's collection
   */
  async addItemsToCollection(data: AddItemsToCollectionJobData): Promise<BullJob<AddItemsToCollectionJobData>> {
    logger.info(
      `Queueing job to add ${data.itemIds.length} items to collection ${data.collectionId} for user ${data.userId}`
    )
    return this.queueAddItemsToCollection.add(JobNameAddItemsToCollection, data)
  }

  /**
   * Remove items from a user's collection
   */
  async removeItemsFromCollection(
    data: RemoveItemsFromCollectionJobData
  ): Promise<BullJob<RemoveItemsFromCollectionJobData>> {
    logger.info(
      `Queueing job to remove ${data.itemIds.length} items from collection ${data.collectionId} for user ${data.userId}`
    )
    return this.queueRemoveItemsFromCollection.add(JobNameRemoveItemsFromCollection, data)
  }

  /**
   * Remove all collection items (delete collection contents)
   */
  async removeAllCollectionItems(
    data: RemoveAllCollectionItemsJobData
  ): Promise<BullJob<RemoveAllCollectionItemsJobData>> {
    logger.info(`Queueing job to remove all items from collection ${data.collectionId} for user ${data.userId}`)
    return this.queueRemoveAllCollectionItems.add(JobNameRemoveAllCollectionItems, data)
  }

  /**
   * Add query result items to collection
   */
  async addQueryResultItemsToCollection(
    data: AddQueryResultItemsToCollectionJobData
  ): Promise<BullJob<AddQueryResultItemsToCollectionJobData>> {
    logger.info(`Queueing job to add query result items to collection ${data.collectionId} for user ${data.userId}`)
    return this.queueAddQueryResultItemsToCollection.add(JobNameAddQueryResultItemsToCollection, data)
  }

  async exportSearchResults(data: ExportSearchResultsJobData): Promise<BullJob<ExportSearchResultsJobData>> {
    logger.info(`Queueing job to export search results for user ${data.userId}`)
    return this.queueExportSearchResults.add(JobNameExportSearchResults, data)
  }

  async migrateOldCollections(data: MigrateOldCollectionsJobData): Promise<BullJob<{}>> {
    logger.info(`Queueing job to migrate old collections`)
    return this.queueMigrateOldCollections.add(JobNameMigrateOldCollections, data)
  }

  /**
   * Get queue statistics
   */
  async getQueueStats() {
    const queues = [
      this.queueAddItemsToCollection,
      this.queueRemoveItemsFromCollection,
      this.queueRemoveAllCollectionItems,
      this.queueAddQueryResultItemsToCollection,
      this.queueExportSearchResults,
      this.queueMigrateOldCollections,
    ]

    const stats = await Promise.all(
      queues.map(async queue => {
        const waiting = await queue.getWaiting()
        const active = await queue.getActive()
        const completed = await queue.getCompleted()
        const failed = await queue.getFailed()

        return {
          name: queue.name,
          waiting: waiting.length,
          active: active.length,
          completed: completed.length,
          failed: failed.length,
        }
      })
    )
    return stats
  }

  /**
   * Clean up resources
   */
  async close(): Promise<void> {
    await this.queueAddItemsToCollection.close()
    await this.queueRemoveItemsFromCollection.close()
    await this.queueRemoveAllCollectionItems.close()
    await this.queueAddQueryResultItemsToCollection.close()
    await this.queueExportSearchResults.close()
    await this.queueMigrateOldCollections.close()
    logger.info('Queue service closed')
  }
}

/**
 * Factory function to create and configure the queue service
 */
export const createQueueService = (app: ImpressoApplication): QueueService => {
  const redisConfig = app.get('redis')

  if (!redisConfig) {
    throw new Error('Redis configuration not available. Cannot initialize queue service.')
  }

  return new QueueService({
    redisConfig,
  })
}

/**
 * Get the queue service from the Feathers app
 */
export const getQueueService = (app: ImpressoApplication): QueueService => {
  const queueService = app.service('queueService') as QueueService
  if (!queueService) {
    throw new Error('Queue service not initialized. Make sure to configure it first.')
  }
  return queueService
}

/**
 * Configure the queue service in the Feathers app
 */
export default (app: ImpressoApplication) => {
  try {
    const queueService = createQueueService(app)

    app.use('queueService', ensureServiceIsFeathersCompatible(queueService), {
      methods: [],
    })

    logger.info('Queue service initialized successfully')
  } catch (error) {
    logger.error('Failed to initialize queue service:', error)
    throw error
  }
}
