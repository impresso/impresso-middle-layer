/* eslint-disable consistent-return */
import { safeStringifyJson } from '../util/jsonCodec'
const debug = require('debug')('impresso/hooks:redis')
const feathers = require('@feathersjs/feathers')
const { generateHash } = require('../crypto')

/**
 * Use in Before hooks. Looks for cache content; if the result exists,
 * flushes the result.
 * When context.result is set in a before hook, the original service method
 * call will be skipped. All other hooks will still execute in their normal order.
 *
 * This hook adds `context.params.cacheKey` only if a redisClient exists
 * and it has been properly configured.
 *
 * If no redis content matches the `context.params.cacheKey`, the after hooks
 * `saveResultsInCache` can use the key to store contents in cache.
 *
 * Note: this hook should be used for find and get method only
 * ça va sans dire
 *
 * @return {feathers.SKIP or undefined} if undefined, following hooks will be loaded
 */
// prettier-ignore
export const checkCachedContents =
  ({
    useAuthenticatedUser = false, //
    useAuthentication = false,
    cacheUnauthenticated = true,
  } = {}) => async context => {
    if (!context.params.provider) {
      debug('checkCachedContents: skipping, internal call');
      return;
    }
    if (!context.app.get('cache').enabled) {
      debug('checkCachedContents: disabled by config');
      return;
    }

    const client = context.app.service('redisClient').client;
    if (!client) {
      debug('checkCachedContents: disabled, redis is not available');
      return;
    }
    debug('checkCachedContents with provider:', context.params.provider);

    const keyParts = [`${context.service.name}.${context.method}`];

    if (!context.params) {
      context.params = {};
    }

    if (!cacheUnauthenticated && !context.params.user) {
      debug('checkCachedContents: disabled, hooks required to cache authenticated only, no user has been given');
      return;
    }

    if (useAuthenticatedUser && context.params.user) {
      debug('checkCachedContents prefix key with user:', context.params.user.uid);
      // prepend user specific cache.
      keyParts.shift(context.params.user.uid);
    }

    if (useAuthentication && context.params.authenticated) {
      debug('checkCachedContents prefix key with authentication');
      // prepend user specific cache.
      keyParts.shift('auth');
    }

    if (context.id) {
      keyParts.push(context.id);
    }

    if (context.params.query) {
      const qs = JSON.stringify(context.params.query);
      keyParts.push(qs.length < 64 ? qs : generateHash(context.params.query));
    }

    // generate key from parameters.
    context.params.cacheKey = keyParts.join('::');

    // look for cache
    const value = await client.get(context.params.cacheKey);

    debug(`checkCachedContents; cacheKey: ${context.params.cacheKey}, exists: ${!!value}`);

    if (value) {
      // setting `result` makes feathers ignore
      // following before hooks and service method.
      context.result = JSON.parse(value);
      context.params.isCached = true;
      return feathers.SKIP;
    }
  };

/**
 * Use in after hooks, should be the first hook.
 * It flushes the result
 *
 * @return {feathers.SKIP or undefined}
 */
// prettier-ignore
export const returnCachedContents =
  ({ skipHooks = false } = {}) => context => {
    debug(`returnCachedContents: ${!!context.params.isCached}`);
    if (context.params.isCached) {
      if (typeof context.result === 'object') {
        context.result.cached = true;
      }
      if (skipHooks) {
        return feathers.SKIP;
      }
    }
  };

/**
 * [saveResultsInCache description]
 * @return {[type]} [description]
 */
export const saveResultsInCache = () => async context => {
  if (context.params.isCached) {
    debug('saveResultsInCache: skipping saving, cached content already served.')
    return
  }
  if (!context.params.cacheKey) {
    return
  }
  const client = context.app.service('redisClient').client
  if (!client) {
    return
  }
  if (!context.result || !Object.keys(context.result).length) {
    debug('saveResultsInCache: skipping, errors found in result!')
    // due to errors
    return
  }
  debug('saveResultsInCache', context.params.cacheKey)
  if (!context.app.get('cache').enabled) {
    debug('checkCachedContents: disabled by config')
    return
  }
  if (!context.params.isCached || context.app.get('cache').override) {
    // do not override cached contents. See returnCachedContents
    await client.set(context.params.cacheKey, safeStringifyJson(context.result))
  }
}
