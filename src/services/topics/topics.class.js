/* eslint-disable no-unused-vars */
const debug = require('debug')('impresso/services/topics');
const { NotFound } = require('@feathersjs/errors');

const SequelizeService = require('../sequelize.service');
const SolrService = require('../solr.service');

class Service {
  constructor ({
    app = null,
    name = '',
  }) {
    this.name = String(name);
    this.app = app;
    // this.sql = SequelizeService({
    //   app,
    //   name,
    // });
    this.solr = SolrService({
      app,
      name,
      namespace: 'topics',
    })
  }

  async find (params) {
    return this.solr.find({
      ... params,
    })
  }

  async get (id, params) {
    return this.solr.get(id);
  }

  async create (data, params) {
    if (Array.isArray(data)) {
      return Promise.all(data.map(current => this.create(current, params)));
    }

    return data;
  }

  async update (id, data, params) {
    return data;
  }

  async patch (id, data, params) {
    return data;
  }

  async remove (id, params) {
    return { id };
  }
}

module.exports = function (options) {
  return new Service(options);
};

module.exports.Service = Service;
