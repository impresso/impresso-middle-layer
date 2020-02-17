/* eslint-disable no-unused-vars */
const debug = require('debug')('impresso/services:me');
const { BadRequest } = require('@feathersjs/errors');
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
      firstname: user.firstname,
      lastname: user.lastname,
      email: user.email,
      uid: user.profile.uid,
      username: user.username,
      isActive: user.isActive,
      isStaff: user.isStaff,
      picture: user.profile.picture,
      pattern: user.profile.pattern,
      creationDate: user.creationDate,
      emailAccepted: user.profile.emailAccepted,
      displayName: user.profile.displayName,
    };
  }

  async update(id, data, params) {
    return data;
  }

  async patch(id, data, params) {
    debug(`[patch] (user:${params.user.uid}) - id:`, params.user.id);
    const user = await this.sequelizeService.get(params.user.id, {});
    const patches = {};

    if (data.sanitized.previousPassword && data.sanitized.newPassword) {
      const isValid = User.comparePassword({
        encrypted: user.password,
        password: data.sanitized.previousPassword,
      });

      if (!isValid) {
        debug('[patch] previous password is wrong');
        throw new BadRequest('Wrong credentials');
      }
      // new password
      const { password } = User.encryptPassword({ password: data.sanitized.newPassword });
      patches.password = password;
      debug(`[patch] (user:${params.user.uid}) set password...`);
    }
    // apply patches
    const patchesApplied = Object.keys(patches);

    const result = await this.sequelizeService.patch(params.user.id, {
      patches,
    }, {});
    debug(`[patch] (user:${params.user.uid}) patches applied!`);
    return {
      uid: user.uid,
      patchesApplied,
    };
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
