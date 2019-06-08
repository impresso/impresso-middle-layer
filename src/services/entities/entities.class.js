/* eslint-disable no-unused-vars */
const debug = require('debug')('impresso/services:entities');
const lodash = require('lodash');
const wikidata = require('../wikidata');
const Entity = require('../../models/entities.model');
const SequelizeService = require('../sequelize.service');


class Service {
  constructor({
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

  async find(params) {
    const where = {};
    // get entities;
    const result = await this.SequelizeService.find({
      query: {
        ...params.query,
      },
      where,
    });
    debug(`'find' total:${result.total}`);
    // get wikidata ids
    const wkdIds = lodash(result.data)
      .map('wikidataId')
      .compact()
      .value();

    const resolvedEntities = {};

    await Promise.all(wkdIds.map(wkdId => wikidata.resolve({
      ids: [wkdId],
      cache: this.app.get('redisClient'),
    }).then((resolved) => {
      resolvedEntities[wkdId] = resolved[wkdId];
    })));

    result.data = result.data.map((d) => {
      if (d.wikidataId) {
        d.wikidata = resolvedEntities[d.wikidataId];
      }
      return d;
    });
    return result;
  }

  async get(id, params) {
    const where = {
      id,
    };

    const entity = await this.SequelizeService.get(id, { where })
      .then(d => d.toJSON());

    if (!entity.wikidataId) {
      return entity;
    }

    return wikidata.resolve({
      ids: [entity.wikidataId],
      cache: this.app.get('redisClient'),
    }).then((res) => {
      if (res[entity.wikidataId]) {
        entity.wikidata = res[entity.wikidataId];
      }
      return entity;
    }).catch((err) => {
      console.log(err);
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
