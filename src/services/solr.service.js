/* eslint global-require: "off" */
/* eslint import/no-dynamic-require: "off" */
const lodash = require('lodash');
const debug = require('debug')('impresso/services:SequelizeService');
const solr = require('../solr');

class SolrService {
  constructor({
    name = '',
    namespace = '',
    app = null,
  } = {}) {
    this.name = String(name);
    this.namespace = String(namespace);

    this.solr = solr.client(app.get('solr'));

    this.Model = require(`../models/${this.name}.model`);
    debug(`Configuring service: ${this.name} success`);
  }

  async get(id, params) {
    const results = await this.solr.findAll({
      q: `id:${id}`,
      limit: 1,
      skip: 0,
      fl: params.fl,
      namespace: this.namespace,
    }, this.Model.solrFactory);
    return lodash.first(results.response.docs);
  }

  async find(params) {
    const results = await this.solr.findAll({
      q: params.q || params.query.sq || '*:*',
      limit: params.query.limit,
      skip: params.query.skip,
      fl: params.fl,
      order_by: params.query.order_by, // default ordering TODO
      namespace: this.namespace,
    }, this.Model.solrFactory);

    return {
      data: results.response.docs,
      total: results.response.numFound,
      limit: params.query.limit,
      skip: params.query.skip,
      info: {
        // params,
        responseTime: {
          solr: results.responseHeader.QTime,
        },
        // solr: results.responseHeader,
      },
    };
  }
}


module.exports = function (options) {
  return new SolrService(options);
};

module.exports.Service = SolrService;
