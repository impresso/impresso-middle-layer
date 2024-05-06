const debug = require('debug')('impresso/celery')
const celery = require('celery-node')
const Job = require('./models/jobs.model')
const { de } = require('chrono-node')

const JOB_STATUS_TRANSLATIONS = {
  REA: 'A new job has been created',
  RUN: 'Job is doing its job ...',
  DON: 'Job done! Congrats.',
}

/**
 *
 * example of config:
 * {
 *     CELERY_BROKER_URL: 'amqp://guest:guest@localhost:5672//',
 *     CELERY_RESULT_BACKEND: 'redis://localhost/5'
 * }
 * @param  {[type]} config [description]
 */
const getCeleryClient = config => {
  const client = celery.createClient(config.CELERY_BROKER_URL, config.CELERY_RESULT_BACKEND)
  debug(
    'getCeleryClient CELERY_BROKER_URL:',
    config.CELERY_BROKER_URL,
    ' CELERY_RESULT_BACKEND:',
    config.CELERY_RESULT_BACKEND
  )
  const run = ({ task = 'impresso.tasks.echo', args = ['this is a test'] } = {}) => {
    debug(`run celery task ${task}`)
    const celeryTask = client.createTask(task)
    const result = celeryTask.applyAsync(args)
    return result
      .get()
      .then(data => {
        debug('Celery task retrieved!', data)
        console.log(data)
        // client.disconnect();
      })
      .catch(err => {
        console.error(err)
        debug(`Error! ${err}`, err)
      })
  }

  return () => ({
    run,
  })
}

module.exports = function (app) {
  const config = app.get('celery')
  // wait for redis to be ready
  if (!config?.enable) {
    debug('Celery is not configured. No task management is available.')
    app.set('celeryClient', null)
  } else {
    debug("Celery configuration found, let's see if it works...")
    try {
      const client = getCeleryClient(config)
      console.log('client', client)
      client.run()
      app.set('celeryClient', client)
    } catch (err) {
      console.error(err)
      debug(`Error! ${err}`, err)
    }
  }
}
