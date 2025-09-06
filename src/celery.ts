import { Application } from '@feathersjs/feathers'
import { HookContext, NextFunction } from '@feathersjs/hooks'
import { createClient } from 'celery-node'
import RedisBackend from 'celery-node/dist/backends/redis'
import debugModule from 'debug'
import { CeleryConfig } from './configuration'
import { logger } from './logger'
import Job from './models/jobs.model.js'
import type { LogData } from './services/logs/logs.class'
import { ImpressoApplication } from './types'
import { AsyncResult } from 'celery-node/dist/app/result'

const debug = debugModule('impresso/celery')

export const JobStatusTranslations: Record<string, string> = {
  REA: 'A new job has been created',
  RUN: 'Job is doing its job ...',
  DON: 'Job done! Congrats.',
}

export interface CeleryClient {
  run: (task: { task: string; args: any[] }) => Promise<AsyncResult>
}

const getCeleryClient = (config: CeleryConfig, app: ImpressoApplication) => {
  const client = createClient(config.brokerUrl, config.backendUrl)
  const backend: RedisBackend = client.backend as RedisBackend

  backend.redis.on('connect', () => {
    backend.redis.psubscribe('celery-task-meta-*', () => {
      debug('Subscribed to celery tasks')
    })

    backend.redis.on('pmessage', (_pattern, _channel, data) => {
      const message = JSON.parse(data)
      const result = message.result

      if (result && typeof result === 'object') {
        if (result.job) {
          debug(`@message related to job: ${result.job.id}, send to: ${result.channel}`, result, result.progress)
          app.service('logs').create({
            tasktype: result.job.type,
            taskname: result.taskname,
            taskstate: result.taskstate,
            progress: result.progress,
            collection: result.collection,
            query: result.query,
            sq: result.query_hash,
            from: 'jobs',
            to: result.channel,
            msg: JobStatusTranslations[result.job.status],
            job: new Job({
              id: result.job.id,
              type: result.job.type,
              status: result.job.status,
              creationDate: result.job.date_created,
              lastModifiedDate: result.job.date_last_modified,
            }),
          } as LogData)
        } else {
          debug('@message from unknown origin, cannot propagate:', result)
        }
      }
    })
  })

  const run = async ({ task = 'impresso.tasks.echo', args = ['this is a test'] } = {}) => {
    debug(`run celery task ${task}`)
    const celeryTask = client.createTask(task)
    return celeryTask.applyAsync(args)

    // @todo: fix this and add errror mnagement
    // const result = celeryTask.applyAsync(args)
    // return result
    //   .get()
    //   .then(data => {
    //     debug('Celery task retrieved!', data)
    //     console.log(data)
    //   })
    //   .catch(err => {
    //     console.error(err)
    //     debug(`Error! ${err}`, err)
    //   })
  }

  return () => ({
    run,
  })
}

export default (app: ImpressoApplication) => {
  const config = app.get('celery')
  // wait for redis to be ready
  if (!config?.enable) {
    logger.warn('Celery: disabled.')
    app.set('celeryClient', undefined)
  } else {
    try {
      const client = getCeleryClient(config, app)()
      app.set('celeryClient', client)
      logger.info('Celery: configured and enabled.')
    } catch (err) {
      logger.error('Celery: an error occurred while configuring celery.', err)
    }
  }
}

export const init = async (context: HookContext<ImpressoApplication & Application>, next: NextFunction) => {
  const client = context.app.get('celeryClient')
  if (client) {
    // # test the connection with a basic echo task
    const response = await client.run({ task: 'impresso.tasks.echo', args: ['this is a test'] })
    logger.info(`Celery is active. Test task ID: ${(response as any).taskId}`)
  }
  await next()
}
