const debug = require('debug')('impresso/celery');
const celery = require('node-celery');


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
const getCeleryClient = (config) => {
  const client = celery.createClient(config);

  client.on('error', (err) => {
    debug(`Error! ${err}`);
  });

  client.on('ready', (err) => {
    debug(`ready! ${err}`);
  });

  client.on('message', (msg) => {
    debug('message!', msg);
    // emit corresponding message
    // for the user channel.
  });

  client.on('connect', async () => {
    debug('Celery is ready!');
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
    app.set('celeryClient', getCeleryClient(config));
  }
};
