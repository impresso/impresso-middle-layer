/* eslint global-require: "off" */
/* eslint import/no-dynamic-require: "off" */
const lodash = require('lodash');
const debug = require('debug')('impresso/services:SolrService');
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
    debug(`get ${id}`, params);
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
    const p = {
      q: params.q || params.query.sq || '*:*',
      limit: params.query.limit,
      skip: params.query.skip,
      fl: params.fl,
      facets: params.query.facets,
      order_by: params.query.order_by, // default ordering TODO
      collapse_by: params.collapse_by,
      collapse_fn: params.collapse_fn,
      namespace: this.namespace,
    };
    // removing unnecessary indefined fields.
    Object.keys(p).forEach(key => p[key] === undefined && delete p[key]);

    const results = await this.solr.findAll(p, this.Model.solrFactory);

    return {
      data: results.response.docs,
      total: results.response.numFound,
      limit: p.limit,
      skip: p.skip,
      info: {
        // params,
        responseTime: {
          solr: results.responseHeader.QTime,
        },
        facets: results.facets,
        // solr: results.responseHeader,
      },
    };
  }
}


module.exports = function (options) {
  return new SolrService(options);
};

module.exports.Service = SolrService;
