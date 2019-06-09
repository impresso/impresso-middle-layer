/* eslint-disable no-unused-vars */
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

    return this.SequelizeService.find({
      query: {
        ...params.query,
      },
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
