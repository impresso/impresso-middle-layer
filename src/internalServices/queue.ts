import { Queue, Worker, Job as BullJob } from 'bullmq'
import { RedisClient } from '../redis'
import { logger } from '../logger'
import { ImpressoApplication } from '../types'
import { RedisConfiguration } from '../configuration'
import { ensureServiceIsFeathersCompatible } from '../util/feathers'
import { AddItemsToCollectionJob, JobNameAddItemsToCollection } from '../jobs/collections/addItemsToCollection'

export const CollectionManagementQueueName = 'collectionsManagement'

export interface QueueServiceOptions {
  redisConfig: RedisConfiguration
}

/**
 * Queue service for managing collections operations using BullMQ
 */
export class QueueService {
  private collectionsManagementQueue: Queue
  private redisConfig: RedisConfiguration

  constructor(options: QueueServiceOptions) {
    this.redisConfig = options.redisConfig

    // Create Redis connection options for BullMQ
    const connectionOptions: any = {
      host: this.redisConfig.host || 'localhost',
      port: this.redisConfig.port || 6379,
    }

    if (this.redisConfig.password) {
      connectionOptions.password = this.redisConfig.password
    }

    if ((this.redisConfig as any).db) {
      connectionOptions.db = (this.redisConfig as any).db
    }

    // Initialize the collectionsManagement queue
    this.collectionsManagementQueue = new Queue(CollectionManagementQueueName, {
      connection: connectionOptions,
      defaultJobOptions: {
        removeOnComplete: 100, // Keep last 100 completed jobs
        removeOnFail: 50, // Keep last 50 failed jobs
        attempts: 5, // Retry failed jobs up to 5 times
        backoff: {
          type: 'exponential',
          delay: 5000, // Start with 5 second delay, exponentially increase
        },
      },
    })

    // Set up event listeners for monitoring
    this.setupEventListeners()
  }

  /**
   * Add items to a user's collection
   */
  async addItemsToCollection(data: AddItemsToCollectionJob): Promise<BullJob<AddItemsToCollectionJob>> {
    logger.info(
      `Queueing job to add ${data.itemIds.length} items to collection ${data.collectionId} for user ${data.userId}`
    )

    return this.collectionsManagementQueue.add(JobNameAddItemsToCollection, data, {
      //   jobId: `add-items-${data.userId}-${data.collectionId}-${Date.now()}`,
    })
  }

  /**
   * Get queue statistics
   */
  async getQueueStats() {
    const waiting = await this.collectionsManagementQueue.getWaiting()
    const active = await this.collectionsManagementQueue.getActive()
    const completed = await this.collectionsManagementQueue.getCompleted()
    const failed = await this.collectionsManagementQueue.getFailed()

    return {
      waiting: waiting.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length,
    }
  }

  /**
   * Get the collections management queue instance
   */
  getCollectionsQueue(): Queue {
    return this.collectionsManagementQueue
  }

  /**
   * Clean up resources
   */
  async close(): Promise<void> {
    await this.collectionsManagementQueue.close()
    logger.info('Queue service closed')
  }

  private setupEventListeners(): void {
    // BullMQ events are handled through QueueEvents, not directly on Queue
    // For now, we'll skip event listeners to avoid TypeScript issues
    // In production, you would set up QueueEvents to monitor job progress
    logger.debug('Queue service event listeners would be set up here')
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
