/* eslint-disable no-unused-vars */
const debug = require('debug')('impresso/services:search');
const solr = require('../../solr');
const article = require('../../models/articles.model');

class Service {
  constructor(options) {
    this.solr = solr.client(options.app.get('solr'));
    this.name = options.name;
    this.options = options || {};
  }

  async find(params) {
    // override params limit according to user role.
    params.query.limit = 2;
    if (params.user) {
      // is authentified
      params.query.limit = params.user.is_staff ? 1000 : 1000;
    }

    debug(`find '${this.name}': query:`, params.query);

    const _solr = await this.solr.findAll({
      q: params.query.sq,
      order_by: params.query.order_by,
      limit: params.query.limit,
      skip: params.query.skip,
      fl: article.ARTICLE_SOLR_FL_TO_CSV,
    }, article.solrFactory);

    const total = _solr.response.numFound;
    debug(`find '${this.name}': SOLR found ${total} using SOLR params:`, _solr.responseHeader.params);

    if (!total) {
      return {
        records: [],
        headers: [],
      };
    }

    return {
      records: _solr.response.docs.map(d => d.toCSV()),
      headers: Object.keys(_solr.response.docs[0]),
    };
  }
}

module.exports = function (options) {
  return new Service(options);
};

module.exports.Service = Service;
