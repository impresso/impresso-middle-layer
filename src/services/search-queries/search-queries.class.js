/* eslint-disable no-unused-vars */
const debug = require('debug')('impresso/services:search-queries');
const SequelizeService = require('../sequelize.service');

exports.SearchQueries = class SearchQueries {
  constructor(options) {
    this.options = options || {};
  }

  setup(app) {
    this.name = 'search-queries';
    this.SequelizeService = new SequelizeService({
      app,
      name: this.name,
    });
    debug('[setup] completed');
  }

  async find(params) {
    return [];
  }

  async get(id, params) {
    return {
      id, text: `A new message with ID: ${id}!`
    };
  }

  async create(data, params) {
    debug('[create] params.user.uid:', params.user.id);
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
