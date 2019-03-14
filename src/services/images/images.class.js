/* eslint-disable no-unused-vars */
const debug = require('debug')('impresso/services:issues');
const SolrService = require('../solr.service');

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
    debug(`find '${this.name}': with params.isSafe:${params.isSafe} and params.query:`, params.query, params);
    return this.SolrService.find({
      ...params,
      fl: 'id',
    });
  }

  async get(id, params) {
    return {
      id, text: `A new message with ID: ${id}!`,
    };
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
