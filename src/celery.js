const debug = require('debug')('impresso/celery');
const celery = require('node-celery');
const Job = require('./models/jobs.model');

const JOB_STATUS_TRANSLATIONS = {
  REA: 'A new job has been created',
  RUN: 'Job is doing its job ...',
  DON: 'Job done! Congrats.',
};

/**
 *
 * example of config:
 * {
 *     CELERY_BROKER_URL: 'amqp://guest:guest@localhost:5672//',
 *     CELERY_RESULT_BACKEND: 'redis://localhost/5'
 *  }
 * @param  {[type]} config [description]
 * @return {[type]}        [description]
 */
const getCeleryClient = (config, app) => {
  const client = celery.createClient(config);

  client.on('error', (err) => {
    debug(`Error! ${err}`);
  });

  client.on('ready', (err) => {
    debug(`ready! ${err}`);
  });
  client.on('message', (msg) => {
    let result = msg.result;

    if (result && typeof result === 'string') {
      try {
        result = JSON.parse(msg);
      } catch (err) {
        debug('@message, ERROR, cannot get json from this string:', result);
        console.error(err);
      }
    }

    if (result && typeof result === 'object') {
      if (result.job) {
        debug(`@message related to job: ${result.job_id}, send to: ${result.user_uid}`, result);
        app.service('logs').create({
          ...result,
          job: new Job({
            ...result.job,
            creationDate: result.job.date_created,
          }),
          msg: JOB_STATUS_TRANSLATIONS[result.job.status],
          to: result.user_uid,
          from: 'jobs',
        });
      } else {
        debug('@message from unknown origin, cannot propagate:', result);
      }
    }
  });

  client.on('connect', async () => {
    debug('Celery is ready!');
  });

  client.run = ({
    task = 'echo',
    args = [],
  } = {}) => new Promise((resolve, reject) => {
    debug(`run celery task ${task}`);
    client.call(task, args, (res) => {
      debug('Celery task retrieved!', res);
      if (['SUCCESS', 'INIT', 'PROGRESS', 'STOPPED'].indexOf(res.status) !== -1) {
        resolve(res);
      } else {
        reject(res);
      }
    });
  });

  return client;
};

module.exports = function (app) {
  const config = app.get('celery');
  if (!config?.enable) {
    debug('Celery is not configured. No task management is available.');
    app.set('celeryClient', null);
  } else {
    debug('Celery configuration found, let\'s see if it works...');
    app.set('celeryClient', getCeleryClient(config, app));
  }
};
