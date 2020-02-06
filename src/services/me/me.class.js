/* eslint-disable no-unused-vars */
const debug = require('debug')('impresso/services:me');
const SequelizeService = require('../sequelize.service');
const User = require('../../models/users.model');

class Service {
  constructor(options) {
    this.options = options || {};
  }

  setup(app) {
    this.app = app;
    this.sequelizeService = new SequelizeService({
      app,
      name: 'me',
      modelName: 'users',
    });
  }

  async find(params) {
    const user = await this.sequelizeService.get(params.user.id, {});
    debug('[find] retrieve current user:', user.profile.uid);
    return {
      email: user.email,
      uid: user.profile.uid,
      firstname: user.firstname,
      lastname: user.lastname,
      creationDate: user.creationDate,
      pattern: user.profile.pattern,
      emailAccepted: user.profile.emailAccepted,
    };
  }

  async update(id, data, params) {
    return data;
  }

  async patch(id, data, params) {
    return data;
  }

  async remove(id, params) {
    // ask for user removal !
    return { id };
  }
}

module.exports = function (options) {
  return new Service(options);
};

module.exports.Service = Service;
