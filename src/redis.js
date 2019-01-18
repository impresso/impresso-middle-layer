const debug = require('debug')('impresso/redis');
const asyncRedis = require('async-redis');

const getSequelizeClient = (config) => {
  const client = asyncRedis.createClient(config);
  client.on('error', (err) => {
    debug(`Error! ${err}`);
  });
  client.on('ready', () => {
    debug('Redis is ready!');
  });
};

module.exports = function (app) {
  const config = app.get('redis');
  if (!config || !config.enable) {
    debug('Redis is not configured. No cache is available.');
    app.set('RedisClient', null);
  } else {
    app.set('RedisClient', getSequelizeClient(config));
  }
};
