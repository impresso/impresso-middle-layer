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

  get(request, namespace, ttl) {
    const options = ttl != null ? { ttl } : {};
    return this.cacheManager.wrap(
      getCacheKeyForSolrRequest(request, namespace, false),
      () => this.solrClient.requestGetRaw(request, namespace),
      options,
    );
  }

  post(request, namespace, ttl) {
    const options = ttl != null ? { ttl } : {};

    return this.cacheManager.wrap(
      getCacheKeyForSolrRequest(request, namespace, true),
      () => this.solrClient.requestPostRaw(request, namespace),
      options,
    );
  }

  get ttl() { return TTL; }

  get namespaces() { return SolrNamespaces; }
}

module.exports = app => new CachedSolrClient(
  app.get('solrClient'),
  app.get('cacheManager'),
);

exports.CachedSolrClient = CachedSolrClient;
