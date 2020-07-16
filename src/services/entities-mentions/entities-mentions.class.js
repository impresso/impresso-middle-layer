// @ts-check

class EntitiesMentions {
  constructor(app) {
    /** @type {import('../../cachedSolr').CachedSolrClient} */
    this.solr = app.get('cachedSolr');
  }

  async create(body) {
    return body;
  }
}

module.exports = { EntitiesMentions };
