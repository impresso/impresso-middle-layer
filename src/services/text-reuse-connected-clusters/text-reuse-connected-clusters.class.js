class TextReuseConnectedClusters {
  constructor(app) {
    /** @type {import('../../cachedSolr').CachedSolrClient} */
    this.solr = app.get('cachedSolr');

    // NOTE: using service to mock while data is not available.
    this.textReuseClustersService = app.service('text-reuse-clusters');
  }

  async find(params) {
    const { clusterId } = params.query;
    const cluster = await this.textReuseClustersService.get(clusterId);
    const nClusters = Math.round(Math.random() * 20);
    return [...Array(nClusters).keys()].map(() => cluster);
  }
}

module.exports = {
  TextReuseConnectedClusters,
};
