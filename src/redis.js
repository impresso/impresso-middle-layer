const debug = require('debug')('impresso/redis');
const asyncRedis = require('async-redis');

const getRedisClient = (config) => {
  const client = asyncRedis.createClient(config);
  client.on('error', (err) => {
    debug(`Error! ${err}`);
  });
  client.on('ready', () => {
    debug('Redis is ready!');
  });
  return client;
};

module.exports = function (app) {
  const config = app.get('redis');
  if (!config || !config.enable) {
    debug('Redis is not configured. No cache is available.');
    app.set('redisClient', null);
  } else {
    debug('Redis configuration found, let\'s see if it works...');
    app.set('redisClient', getRedisClient(config));
  }
};
