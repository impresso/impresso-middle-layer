const debug = require('debug')('impresso/services:newspapers');
const SequelizeService = require('../sequelize.service');
const { Op } = require('sequelize');

class Service {
  constructor({
    app,
    name = '',
  } = {}) {
    this.app = app;
    this.name = name;
    this.SequelizeService = SequelizeService({
      app,
      name,
    });
  }

  /**
   * get a single newspaper.
   * @param  {String}  id     uid or acronym of the newspaper
   * @return {Promise}        [description]
   */
  async get(id) {
    const where = {
      uid: id,
    };
    return this.SequelizeService.get(id, {
      scope: 'get',
      where,
    });
  }

  async find(params) {
    debug(`find '${this.name}': with params.isSafe:${params.isSafe} and params.query:`, params.query);

    const where = {};

    if (params.query.q) {
      where[Op.or] = [
        { name: params.query.q },
        { uid: params.query.q },
      ];
    }

    return this.SequelizeService.find({
      ...params,
      where,
      distinct: true,
    });
  }
}

module.exports = function (options) {
  return new Service(options);
};
module.exports.Service = Service;
