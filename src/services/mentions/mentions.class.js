/* eslint-disable no-unused-vars */
const debug = require('debug')('impresso/services:mentions');
const EntityMention = require('../../models/entity-mentions.model');
const SequelizeService = require('../sequelize.service');


/* eslint-disable no-unused-vars */
class Service {
  constructor({
    name = '',
    app = null,
  } = {}) {
    this.name = String(name);
    this.app = app;
    this.SequelizeService = SequelizeService({
      app,
      name: 'entity-mentions',
    });
  }


  async find(params) {
    const where = {
      // creatorId: params.user.id,
    };
    const findAllOnly = !params.sanitized.sequelizeQuery;
    if (params.sanitized.sequelizeQuery) {
      where.$and = params.sanitized.sequelizeQuery;
    }
    debug(`find '${this.name}': with params.isSafe:${params.isSafe} and params.query:`, params.query, findAllOnly);

    return this.SequelizeService.find({
      ...params,
      findAllOnly,
      where,
    });
  }

  async get(id, params) {
    return this.SequelizeService.get(id).then(result => result.toJSON());
  }
}

module.exports = function (options) {
  return new Service(options);
};

module.exports.Service = Service;
