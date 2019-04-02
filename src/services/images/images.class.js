/* eslint-disable no-unused-vars */
const debug = require('debug')('impresso/services:images');
const SolrService = require('../solr.service');
const Image = require('../../models/images.model');

class Service {
  constructor({
    app = null,
    name = '',
  }) {
    this.app = app;
    this.name = name;
    this.SolrService = SolrService({
      app,
      name,
      namespace: 'images',
    });
  }

  async find(params) {
    debug(`find '${this.name}': with params.isSafe:${params.isSafe} and params.query:`, params.query);
    return this.SolrService.find({
      ...params,
      fl: Image.SOLR_FL,
    });
  }

  async get(id, params) {
    debug(`get '${this.name}': with params.isSafe:${params.isSafe} and params.query:`, params.query);
    return this.SolrService.get(id, {
      fl: Image.SOLR_FL,
    });
  }

  async create(data, params) {
    if (Array.isArray(data)) {
      return Promise.all(data.map(current => this.create(current, params)));
    }

    return data;
  }

  async update(id, data, params) {
    return data;
  }

  async patch(id, data, params) {
    return data;
  }

  async remove(id, params) {
    return { id };
  }
}

module.exports = function (options) {
  return new Service(options);
};

module.exports.Service = Service;
