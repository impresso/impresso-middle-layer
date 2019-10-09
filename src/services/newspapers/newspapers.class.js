const debug = require('debug')('impresso/services:newspapers');
const { Op } = require('sequelize');
const SequelizeService = require('../sequelize.service');

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
    }).then(d => d.toJSON());
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

    const scope = params.query.faster ? 'lookup' : 'find';

    if (params.query.filters && params.query.filters.length) {
      where[Op.and] = [];
      if (params.query.filters.some(d => d.type === 'included')) {
        where[Op.and].push({
          '$stats.start$': { [Op.not]: null },
        });
      } else if (params.query.filters.some(d => d.type === 'excluded')) {
        where[Op.and].push({
          '$stats.start$': { [Op.is]: null },
        });
      }
    }

    return this.SequelizeService.find({
      ...params,
      where,
      scope,
      distinct: true,
    });
  }
}

module.exports = function (options) {
  return new Service(options);
};
module.exports.Service = Service;
