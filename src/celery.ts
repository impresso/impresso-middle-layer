import { Application, HookContext, NextFunction } from '@feathersjs/feathers'
import { createClient } from 'celery-node'
import RedisBackend from 'celery-node/dist/backends/redis'
import debugModule from 'debug'
import { CeleryConfiguration } from './configuration'
import { logger } from './logger'
import Job from './models/jobs.model'
import { ImpressoApplication } from './types'
import { AsyncResult } from 'celery-node/dist/app/result'

const debug = debugModule('impresso/celery')

const JOB_STATUS_TRANSLATIONS: Record<string, string> = {
  REA: 'A new job has been created',
  RUN: 'Job is doing its job ...',
  DON: 'Job done! Congrats.',
}

export interface CeleryClient {
  run: (task: { task: string; args: any[] }) => Promise<AsyncResult>
}

const getCeleryClient = (config: CeleryConfiguration, app: ImpressoApplication) => {
  const client = createClient(config.brokerUrl, config.backendUrl)
  const backend: RedisBackend = client.backend as RedisBackend

  backend.redis.on('connect', () => {
    backend.redis.psubscribe('celery-task-meta-*', () => {
      debug('Subscribed to celery tasks')
    })

    backend.redis.on('pmessage', (pattern, channel, data) => {
      const message = JSON.parse(data)
      const result = message.result

      if (result && typeof result === 'object') {
        if (result.job) {
          debug(`@message related to job: ${result.job_id}, send to: ${result.user_uid}`, result)
          app.service('logs').create({
            ...result,
            job: new Job({
              ...result.job,
              creationDate: result.job.date_created,
            }),
            msg: JOB_STATUS_TRANSLATIONS[result.job.status],
            to: result.user_uid,
            from: 'jobs',
          })
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
    logger.warning('Celery is not configured. No task management is available.')
    app.set('celeryClient', undefined)
  } else {
    logger.info('Enabling Celery...')
    try {
      const client = getCeleryClient(config, app)()
      app.set('celeryClient', client)
    } catch (err) {
      logger.error(err)
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
