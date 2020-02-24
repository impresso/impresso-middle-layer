const cacheManager = require('cache-manager');
const redisStore = require('cache-manager-redis-store');

function init(configuration, isEnabled, errorHandler) {
  const cache = cacheManager.caching({
    store: isEnabled ? redisStore : 'none',
    host: configuration.host || 'localhost',
    port: configuration.port || 6379,
    auth_pass: configuration.pass || undefined,
    ttl: configuration.ttl || 600, // 15 minutes by default
  });

  if (isEnabled && errorHandler != null) {
    cache.store.getClient().on('error', errorHandler);
  }

  return cache;
}


module.exports = init;
