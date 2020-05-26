const { SolrNamespaces } = require('./solr');

const TTL = Object.freeze({
  Short: 60, // 1 minute
  Long: 60 * 60 * 24, // 1 day
  Forever: 1000 * 365 * 60 * 60 * 24, // 1000 years
  Default: undefined, // set in cache configuration.
});

const CacheKeyPrefix = Object.freeze({
  Solr: 'solr',
  Data: 'data',
});

function getCacheKeyForSolrRequest(
  request, namespace, isPost = false,
  prefix = CacheKeyPrefix.Solr,
) {
  const requestString = Buffer.from(JSON.stringify(request)).toString('base64');
  return [
    'cache',
    prefix,
    namespace != null ? namespace : 'default',
    isPost ? 'post' : 'get',
    requestString,
  ].join(':');
}

/**
 * Standard cache options.
 * @typedef {{ ttl?: number, skipCache?: boolean }} Options
 */

class CachedSolrClient {
  constructor(solrClient, cacheManager) {
    this.solrClient = solrClient;
    this.cacheManager = cacheManager;
  }

  /**
   * Send a `GET` request to Solr.
   * @param {any} request Solr request parameters
   * @param {string} namespace namespace to use.
   * @param {Options} options cache options.
   *
   * @returns {any} unmodified Solr response.
   */
  get(request, namespace = undefined, options = undefined) {
    const {
      ttl = TTL.Long,
      skipCache = false,
      cachePrefix = CacheKeyPrefix.Solr,
    } = options || {};

    const cacheOptions = { ttl };
    const fn = () => this.solrClient.requestGetRaw(request, namespace);

    if (skipCache) return fn();

    return this.cacheManager.wrap(
      getCacheKeyForSolrRequest(request, namespace, false, cachePrefix),
      fn,
      cacheOptions,
    );
  }

  /**
   * Send a `POST` request to Solr.
   * @param {any} request Solr request body
   * @param {string} namespace namespace to use.
   * @param {Options} options cache options.
   *
   * @returns {any} unmodified Solr response.
   */
  async post(request, namespace = undefined, options = undefined) {
    const {
      ttl = TTL.Long, skipCache = false,
      cachePrefix = CacheKeyPrefix.Solr,
    } = options || {};

    const cacheOptions = { ttl };
    const fn = () => this.solrClient.requestPostRaw(request, namespace);

    if (skipCache) return fn();

    return this.cacheManager.wrap(
      getCacheKeyForSolrRequest(request, namespace, true, cachePrefix),
      fn,
      cacheOptions,
    );
  }

  /**
   * Search articles.
   * NOTE: Deprecated method. Use `get` or `post`.
   * @param {any} request a semi preprocessed Solr request.
   * @param {Options} options standard options.
   *
   * @returns {any} solr response
   */
  findAllPost(request, options = undefined) {
    const namespace = SolrNamespaces.Search;
    const { ttl = TTL.Long, skipCache = false } = options || {};

    const cacheOptions = { ttl };
    const fn = () => this.solrClient.findAllPost(request);

    if (skipCache) return fn();

    return this.cacheManager.wrap(
      getCacheKeyForSolrRequest(request, namespace, true),
      fn,
      cacheOptions,
    );
  }

  /**
   * Search items.
   * NOTE: Deprecated method. Use `get` or `post`.
   * @param {any} request a semi preprocessed Solr request.
   * @param {(any) => any} factory factory method to convert items into something else.
   * @param {Options} options standard options.
   *
   * @returns {any} solr response
   */
  findAll(request, factory = undefined, options = undefined) {
    const { namespace } = request;
    const {
      ttl = TTL.Long,
      skipCache = false,
      cachePrefix = CacheKeyPrefix.Solr,
    } = options || {};

    const cacheOptions = { ttl };
    const fn = () => this.solrClient.findAll(request);
    const resultPromise = skipCache
      ? fn()
      : this.cacheManager.wrap(
        getCacheKeyForSolrRequest(request, namespace, false, cachePrefix),
        fn,
        cacheOptions,
      );
    return resultPromise.then((result) => {
      // Same as the code used in `solrClient.findAll`.
      // It's here because `cacheManager` works with JSON whereas
      // factory creates a custom JS class instance which cannot be
      // properly serialised.
      if (factory) {
        result.response.docs = result.response.docs.map(factory(result));
      }
      return result;
    });
  }

  suggest(request, factory, ttl = TTL.Long) {
    const { namespace } = request;
    const options = ttl != null ? { ttl } : {};

    return this.cacheManager.wrap(
      getCacheKeyForSolrRequest(request, namespace, false),
      () => this.solrClient.suggest(request),
      options,
    ).then((resultItems) => {
      // Same as the code used in `solrClient.suggest`.
      // It's here because `cacheManager` works with JSON whereas
      // factory creates a custom JS class instance which cannot be
      // properly serialised.
      if (factory) {
        return resultItems.map(factory());
      }
      return resultItems;
    });
  }

  get ttl() { return TTL; }

  get namespaces() { return SolrNamespaces; }

  get cacheKeyPrefix() { return CacheKeyPrefix; }
}

module.exports = app => new CachedSolrClient(
  app.get('solrClient'),
  app.get('cacheManager'),
);

exports.CachedSolrClient = CachedSolrClient;
