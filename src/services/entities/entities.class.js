/* eslint-disable no-unused-vars */
const wikidata = require('../wikidata');
const Entity = require('../../models/entities.model');
const SequelizeService = require('../sequelize.service');

class Service {
  constructor ({
    app = null,
    name = '',
  } = {}) {
    this.app = app;
    this.name = name;
    this.SequelizeService = SequelizeService({
      app,
      name,
    });
  }

  async find (params) {
    const where = {};
    // get entities;
    return this.SequelizeService.find({
      query: {
        ...params.query,
      },
      where,
    });
  }

  async get (id, params) {
    const entity = new Entity({
      id: 0,
      label: 'Douglas Adams',
      wikidataId: 'Q42',
      type: 'human',
    });

    return wikidata.resolve({
      ids: ['Q42'],
      cache: this.app.get('redisClient'),
    }).then((res) => {
      if(res[entity.wikidataId]) {
        entity.wikidata = res[entity.wikidataId];
      }
      return entity;
    }).catch((err) => {
      console.log(err);
    });
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
