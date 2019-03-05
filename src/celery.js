const debug = require('debug')('impresso/celery');
const celery = require('node-celery');

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
    debug('message!', msg);

    if (msg.result && typeof msg.result === 'object') {
       if(msg.result.job_id) {
         app.service('logs').create({
           task: msg.result.task,
           job: {
             id: msg.result.job_id,
             status: msg.result.job_status,
             progress: msg.result.progress,
           },
           msg: JOB_STATUS_TRANSLATIONS[msg.result.job_status],
           to: msg.result.user_uid,
           from: 'jobs',
         });
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
      if (['SUCCESS', 'INIT', 'PROGRESS'].indexOf(res.status) !== -1) {
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
  if (!config || !config.enable) {
    debug('Celery is not configured. No task management is available.');
    app.set('celeryClient', null);
  } else {
    debug('Celery configuration found, let\'s see if it works...');
    app.set('celeryClient', getCeleryClient(config, app));
  }
};
