import { Worker } from 'bullmq'
import { logger } from '../logger'
import { ImpressoApplication } from '../types'
import { RedisConfiguration } from '../configuration'
import { ensureServiceIsFeathersCompatible } from '../util/feathers'
import {
  AddItemsToCollectionJob,
  createJobHandler as createAddItemsToCollectionJobHandler,
  JobNameAddItemsToCollection,
} from '../jobs/collections/addItemsToCollection'
import { CollectionManagementQueueName } from './queue'
import { Application, NextFunction } from '@feathersjs/feathers'
import { HookContext } from '@feathersjs/hooks'

export interface WorkerManagerOptions {
  app: ImpressoApplication
  redisConfig: RedisConfiguration
  concurrency?: number
  workerCount?: number
}

/**
 * Worker Manager service for managing BullMQ workers
 */
export class WorkerManagerService {
  private workers: Worker<any, any, any>[] = []
  private redisConfig: RedisConfiguration
  private concurrency: number
  private workerCount: number
  private isRunning: boolean = false
  private app: ImpressoApplication

  constructor(options: WorkerManagerOptions) {
    this.redisConfig = options.redisConfig
    this.concurrency = options.concurrency || 1
    this.workerCount = options.workerCount || 3
    this.app = options.app
  }

  /**
   * Start all workers
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Workers are already running')
      return
    }

    logger.info(`Starting ${this.workerCount} workers with concurrency ${this.concurrency}`)

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

    const addItemsToCollectionJobHandler = createAddItemsToCollectionJobHandler(this.app)

    const worker = new Worker<AddItemsToCollectionJob, undefined, typeof JobNameAddItemsToCollection>(
      CollectionManagementQueueName,
      addItemsToCollectionJobHandler,
      {
        connection: connectionOptions,
        concurrency: this.concurrency,
      }
    )

    this.workers.push(worker)

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
      concurrency: this.concurrency,
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

  private setupWorkerEventListeners(worker: Worker, workerId: number): void {
    worker.on('completed', job => {
      logger.info(`Worker ${workerId}: Job ${job.id} completed successfully`)
    })

    worker.on('failed', (job, err) => {
      logger.error(`Worker ${workerId}: Job ${job?.id} failed:`, err)
    })

    worker.on('active', job => {
      logger.debug(`Worker ${workerId}: Job ${job.id} started processing`)
    })

    worker.on('stalled', jobId => {
      logger.warn(`Worker ${workerId}: Job ${jobId} stalled`)
    })

    worker.on('error', err => {
      logger.error(`Worker ${workerId}: Error occurred:`, err)
    })

    worker.on('ready', () => {
      logger.debug(`Worker ${workerId}: Ready and waiting for jobs`)
    })

    worker.on('closing', () => {
      logger.debug(`Worker ${workerId}: Closing...`)
    })
  }
}

/**
 * Factory function to create and configure the worker manager service
 */
export const createWorkerManagerService = (app: ImpressoApplication): WorkerManagerService => {
  const redisConfig = app.get('redis')

  if (!redisConfig) {
    throw new Error('Redis configuration not available. Cannot initialize worker manager service.')
  }

  // Get configuration for workers (with defaults)
  //   const workerConfig = app.get('workers') || {}
  const concurrency = 1 //workerConfig.concurrency || 1
  const workerCount = 3 // workerConfig.count || 3

  return new WorkerManagerService({
    app,
    redisConfig,
    concurrency,
    workerCount,
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
    const workerManagerService = createWorkerManagerService(app)

    // Register as a service
    app.use('workerManagerService', ensureServiceIsFeathersCompatible(workerManagerService), {
      methods: [],
    })

    // // Auto-start workers if configured to do so
    // const workerConfig = app.get('workers') || {}
    // if (workerConfig.autoStart !== false) {
    //   // Start workers after a short delay to allow other services to initialize
    //   setTimeout(async () => {
    //     try {
    //       await workerManagerService.start()
    //     } catch (error) {
    //       logger.error('Failed to auto-start workers:', error)
    //     }
    //   }, 1000)
    // }

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
