const assert = require('assert');
const { SolrNamespaces } = require('./solr');

function getCacheKeyForSolrRequest(request, namespace, isPost = false) {
  const requestString = Buffer.from(JSON.stringify(request)).toString('base64');
  return [
    'cache',
    'solr',
    namespace != null ? namespace : 'default',
    isPost ? 'post' : 'get',
    requestString,
  ].join(':');
}

const TTL = Object.freeze({
  Short: 60, // 1 minute
  Long: 60 * 60 * 24, // 1 day
  Default: undefined, // set in cache configuration.
});

class CachedSolrClient {
  constructor(solrClient, cacheManager) {
    this.solrClient = solrClient;
    this.cacheManager = cacheManager;
  }


  get(request, namespace, ttl = undefined) {
    const options = ttl != null ? { ttl } : {};
    return this.cacheManager.wrap(
      getCacheKeyForSolrRequest(request, namespace, false),
      () => this.solrClient.requestGetRaw(request, namespace),
      options,
    );
  }

  async post(request, namespace, ttl = undefined) {
    const options = ttl != null ? { ttl } : {};

    return this.cacheManager.wrap(
      getCacheKeyForSolrRequest(request, namespace, true),
      () => this.solrClient.requestPostRaw(request, namespace),
      options,
    );
  }

  findAllPost(request, namespace = SolrNamespaces.Search, ttl = TTL.Long) {
    assert.equal(namespace, SolrNamespaces.Search, `Only "${SolrNamespaces.Search}" namespace is supported`);
    const options = ttl != null ? { ttl } : {};

    return this.cacheManager.wrap(
      getCacheKeyForSolrRequest(request, namespace, true),
      () => this.solrClient.findAllPost(request),
      options,
    );
  }

  findAll(request, factory, ttl = TTL.Long) {
    const { namespace = SolrNamespaces.Search } = request;
    assert.equal(namespace, SolrNamespaces.Search, `Only "${SolrNamespaces.Search}" namespace is supported`);

    const options = ttl != null ? { ttl } : {};

    return this.cacheManager.wrap(
      getCacheKeyForSolrRequest(request, namespace, false),
      () => this.solrClient.findAll(request),
      options,
    ).then((result) => {
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
}

module.exports = app => new CachedSolrClient(
  app.get('solrClient'),
  app.get('cacheManager'),
);

exports.CachedSolrClient = CachedSolrClient;
