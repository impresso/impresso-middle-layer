const Neo4jService = require('../neo4j.service').Service;
const solr = require('../../solr');
const { NotFound } = require('@feathersjs/errors');

class Service extends Neo4jService {
  constructor(options) {
    super(options);
    this.solr = solr.client(options.app.get('solr'));
  }

  async get(id, params) {
    const uids = id.split(',');

    if (uids.length > 1) {
      return super.get(id, params);
    }

    const results = await Promise.all([
      // we perform a solr request to get
      // the full text, regions of the specified article
      this.solr.findAll({
        q: `id:${id}`,
        fl: 'id,page_nb_is,title_txt_fr,content_txt_fr',
      }),
      // at the same time, we use the neo4jService get to get article instance from our graph db
      super.get(id, params),
    ]);

    if (results[0].response.numFound !== 1) {
      throw new NotFound();
    }

    return {
      ...results[0].response.docs[0],
      ...results[1],
    };
  }
}

module.exports = function (options) {
  return new Service(options);
};

module.exports.Service = Service;
