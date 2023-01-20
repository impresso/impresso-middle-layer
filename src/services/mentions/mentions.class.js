/* eslint-disable no-unused-vars */
const { Op } = require('sequelize');
const debug = require('debug')('impresso/services:mentions');
const EntityMention = require('../../models/entity-mentions.model');
const SequelizeService = require('../sequelize.service');
const { measureTime } = require('../../util/instruments');

/* eslint-disable no-unused-vars */
class Service {
  constructor (options) {
    this.options = options;
  }

  setup (app) {
    this.app = app;
    this.sequelizeService = SequelizeService({
      app,
      name: 'entity-mentions',
    });
  }

  async find (params) {
    const where = {};

    const findAllOnly = params.query.faster || !params.sanitized.sequelizeQuery;
    if (params.sanitized.sequelizeQuery) {
      where[Op.and] = params.sanitized.sequelizeQuery;
    }
    debug(`[find] with params.isSafe:${params.isSafe} and params.query:`, params.query, findAllOnly);
    return measureTime(() => this.sequelizeService.find({
      ...params,
      findAllOnly,
      where,
    }).then((res) => {
      debug('[find] success! total:', res.total);
      return res;
    }), 'mentions.find.db.mentions');
  }

  async get (id, params) {
    return measureTime(() => this.sequelizeService.get(id).then(result => result.toJSON()), 'mentions.get.db.mention');
  }
}

module.exports = function (options) {
  return new Service(options);
};

module.exports.Service = Service;
