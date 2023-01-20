const cacheManager = require('cache-manager');
const redisStore = require('cache-manager-redis-store');

function init (configuration, isEnabled, errorHandler) {
  const cache = cacheManager.caching({
    store: isEnabled ? redisStore : 'none',
    host: configuration.host || 'localhost',
    port: configuration.port || 6379,
    auth_pass: configuration.pass || undefined,
    ttl: configuration.ttl || 60 * 60 * 24 * 30 * 6, // ~6 months by default
  });

  if (isEnabled && errorHandler != null) {
    cache.store.getClient().on('error', errorHandler);
  }

  return cache;
}

module.exports = init;
