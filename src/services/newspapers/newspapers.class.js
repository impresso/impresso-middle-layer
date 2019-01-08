const debug = require('debug')('impresso/services:newspapers');
const SequelizeService = require('../sequelize.service');

class Service {
  constructor({
    app,
    name = '',
  } = {}) {
    this.app = app;
    this.SequelizeService = SequelizeService({
      app,
      name,
    });
  }
  async find(params) {
    debug(`find '${this.name}': with params.isSafe:${params.isSafe} and params.query:`, params.query);

    const where = {};

    if (params.query.q) {
      where.$or = [
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
