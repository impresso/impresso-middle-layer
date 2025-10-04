import { Application, NextFunction } from '@feathersjs/feathers'
import { HookContext } from '@feathersjs/hooks'
import { Processor, QueueEvents, Worker } from 'bullmq'
import { RedisConfiguration } from '../configuration'
import {
  createJobHandler as createAddItemsToCollectionJobHandler,
  JobNameAddItemsToCollection,
} from '../jobs/collections/addItemsToCollection'
import {
  createJobHandler as createAddQueryResultItemsToCollectionJobHandler,
  JobNameAddQueryResultItemsToCollection,
} from '../jobs/collections/addQueryResultItemsToCollection'
import {
  JobNameRemoveAllCollectionItems,
  createJobHandler as removeAllCollectionItemsJobHandler,
} from '../jobs/collections/removeAllCollectionItems'
import {
  JobNameRemoveItemsFromCollection,
  createJobHandler as removeItemsToCollectionJobHandler,
} from '../jobs/collections/removeItemsFromCollection'
import {
  createJobHandler as exportSearchResultsJobHandler,
  JobNameExportSearchResults,
} from '../jobs/searchResults/exportSearchResults'
import {
  createJobHandler as createMigrateOldCollectionsJobHandler,
  JobNameMigrateOldCollections,
} from '../jobs/collections/migrateOldCollections'
import { logger } from '../logger'
import { ImpressoApplication } from '../types'
import { ensureServiceIsFeathersCompatible } from '../util/feathers'

type WorkerDefinition = [string /* queue name*/, Processor<any, any, any>, number /* concurrency */]

export interface WorkerManagerOptions {
  redisConfig: RedisConfiguration
  workerDefinitions: WorkerDefinition[]
}

/**
 * Worker Manager service for managing BullMQ workers
 */
export class WorkerManagerService {
  private workers: Worker<any, any, any>[] = []
  private redisConfig: RedisConfiguration
  private isRunning: boolean = false
  private workerDefinitions: WorkerDefinition[]

  constructor(options: WorkerManagerOptions) {
    this.redisConfig = options.redisConfig
    this.workerDefinitions = options.workerDefinitions
  }

  /**
   * Start all workers
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Workers are already running')
      return
    }

    // Create Redis connection options for BullMQ workers
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

    this.workerDefinitions.forEach(([queueName, processor, concurrency]) => {
      const worker = new Worker(queueName, processor, {
        connection: connectionOptions,
        concurrency: concurrency,
      })
      this.workers.push(worker)
      logger.info(`Starting ${worker.name} on '${queueName}' queue with concurrency ${concurrency}`)
    })

    const queues = new Set(this.workerDefinitions.map(([queueName]) => queueName))
    queues.forEach(queueName => this.setupEventListeners(queueName))

    this.isRunning = true
    logger.info(`Successfully started ${this.workers.length} workers`)
  }

  /**
   * Stop all workers
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      logger.warn('Workers are not running')
      return
    }

    logger.info(`Stopping ${this.workers.length} workers...`)

    const stopPromises = this.workers.map(async (worker, index) => {
      try {
        await worker.close()
        logger.debug(`Worker ${index + 1} stopped successfully`)
      } catch (error) {
        logger.error(`Error stopping worker ${index + 1}:`, error)
      }
    })

    await Promise.allSettled(stopPromises)

    this.workers = []
    this.isRunning = false
    logger.info('All workers stopped')
  }

  /**
   * Get worker statistics
   */
  getStats() {
    return {
      workerCount: this.workers.length,
      isRunning: this.isRunning,
      workers: this.workers.map((worker, index) => ({
        id: index + 1,
        name: worker.name,
        running: worker.isRunning(),
      })),
    }
  }

  /**
   * Restart all workers
   */
  async restart(): Promise<void> {
    logger.info('Restarting workers...')
    await this.stop()
    await this.start()
  }

  /**
   * Check if workers are running
   */
  isActive(): boolean {
    return this.isRunning && this.workers.length > 0
  }

  private setupEventListeners(queueName: string): void {
    const queueEvents = new QueueEvents(queueName)

    queueEvents.on('completed', job => {
      logger.info(`[JOB] Job ${job.jobId} completed successfully: ${job.returnvalue}`)
    })

    queueEvents.on('failed', (job, err) => {
      logger.error(`[JOB] Job ${job.jobId} failed: (${job.failedReason})`, err)
    })

    queueEvents.on('active', job => {
      logger.debug(`[JOB] Job ${job.jobId} started processing`)
    })

    queueEvents.on('stalled', job => {
      logger.warn(`[JOB] Job ${job.jobId} stalled`)
    })

    queueEvents.on('error', err => {
      logger.error(`[JOB] Error occurred:`, err)
    })
  }
}

/**
 * Factory function to create and configure the worker manager service
 */
export const createWorkerManagerService = (
  app: ImpressoApplication,
  workerDefinitions: WorkerDefinition[]
): WorkerManagerService => {
  const redisConfig = app.get('redis')

  if (!redisConfig) {
    throw new Error('Redis configuration not available. Cannot initialize worker manager service.')
  }

  return new WorkerManagerService({
    workerDefinitions,
    redisConfig,
  })
}

/**
 * Get the worker manager service from the Feathers app
 */
export const getWorkerManagerService = (app: ImpressoApplication): WorkerManagerService => {
  const workerManagerService = app.service('workerManagerService') as WorkerManagerService
  if (!workerManagerService) {
    throw new Error('Worker manager service not initialized. Make sure to configure it first.')
  }
  return workerManagerService
}

/**
 * Configure the worker manager service in the Feathers app
 */
export default (app: ImpressoApplication) => {
  try {
    const workerDefinitions: WorkerDefinition[] = [
      [JobNameAddItemsToCollection, createAddItemsToCollectionJobHandler(app), 1],
      [JobNameRemoveItemsFromCollection, removeItemsToCollectionJobHandler(app), 1],
      [JobNameRemoveAllCollectionItems, removeAllCollectionItemsJobHandler(app), 1],
      [JobNameAddQueryResultItemsToCollection, createAddQueryResultItemsToCollectionJobHandler(app), 1],
      [JobNameExportSearchResults, exportSearchResultsJobHandler(app), 1],
      [JobNameMigrateOldCollections, createMigrateOldCollectionsJobHandler(app), 1],
    ]

    const workerManagerService = createWorkerManagerService(app, workerDefinitions)

    // Register as a service
    app.use('workerManagerService', ensureServiceIsFeathersCompatible(workerManagerService), {
      methods: [],
    })

    logger.info('Worker manager service initialized successfully')
  } catch (error) {
    logger.error('Failed to initialize worker manager service:', error)
    throw error
  }
}

export const start = async (context: HookContext<ImpressoApplication & Application>, next: NextFunction) => {
  const service = context.app.service('workerManagerService') as WorkerManagerService
  if (service) {
    try {
      await service.start()
    } catch (err) {
      logger.error('Error starting worker manager service:', err)
    }
  } else {
    logger.warn('Worker manager service is not configured. Cannot start workers.')
  }
  await next()
}
