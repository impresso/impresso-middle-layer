const debug = require('debug')('impresso/services:newspapers');

const FusionService = require('../fusion.service').Service;
const Newspaper = require('../../models/newspapers.model');


class Service extends FusionService {
  async find(params) {
    debug(`find '${this.name}': with params.isSafe:${params.isSafe} and params.query:`, params.query);

    const where = {};

    if (params.query.q) {
      where.name = params.query.q;
    }
    // pure findAll, limit and offset only
    const results = await this.sequelizeKlass.scope('findAll').findAll({
      where,
      offset: params.query.skip,
      limit: params.query.limit,
    });

    return FusionService.wrap(
      results.map(d => new Newspaper(d.toJSON())),
      params.query.limit, params.query.skip, 0,
    );
  }
}

module.exports = function (options) {
  return new Service(options);
};
module.exports.Service = Service;
