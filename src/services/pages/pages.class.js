/* eslint-disable no-unused-vars */
const Neo4jService = require('../neo4j.service').Service;
const solr = require('../../solr');
const { NotFound } = require('@feathersjs/errors');

class Service extends Neo4jService {
  constructor(options) {
    super(options);
    this.solr = solr.client(options.app.get('solr'));
  }

  async get(id, params) {
    const results = await Promise.all([
      // we perform a solr request to get
      // the full text, regions of the specified article
      this.solr.findAll({
        q: `page_id_ss:${id}}`,
        fl: article.ARTICLE_SOLR_FL_LITE,
      }, article.solrFactory),
      // at the same time, we use the neo4jService get to get article instance from our graph db
      super.get(id, {
        ...params,
        findAll: uids.length > 1,
      }),
      // get from db
    ]);

    if (results[0].response.numFound !== 1) {
      throw new NotFound();
    }

  }

}

module.exports = function (options) {
  return new Service(options);
};

module.exports.Service = Service;
