/* eslint-disable no-unused-vars */
const { BadRequest, NotFound } = require('@feathersjs/errors');
const shorthash = require('short-hash');
const nanoid = require('nanoid');
const { Op } = require('sequelize');
const debug = require('debug')('impresso/services:users');
const { encrypt } = require('../../crypto');
const sequelize = require('../../sequelize');
const { sequelizeErrorHandler } = require('../../services/sequelize.utils');
const User = require('../../models/users.model');
const Profile = require('../../models/profiles.model');

class Service {
  constructor({ app }) {
    this.sequelizeClient = app.get('sequelizeClient');
    this.sequelizeKlass = User.sequelize(this.sequelizeClient);
    this.id = 'id';
    this.app = app;
  }

  async get(id, params) {
    // if you're staff; otherwise get your own.
    const user = await this.sequelizeKlass.scope('isActive', 'get').findOne({
      where: {
        [Op.or]: [{ id }, { username: id }, { '$profile.uid$': id }],
      },
    });
    if (!user) {
      debug('[get] uid not found <uid>:', id);
      throw new NotFound();
    }
    const groups = await user.getGroups().then(res => res.map(d => d.toJSON()));
    debug('[get] user <uid>:', user.profile.uid, '<groups>:', groups);
    return user.toJSON({ groups });
  }

  async create(data, params = {}) {
    // prepare empty user.
    const user = new User();
    user.password = User.buildPassword({
      password: data.sanitized.password,
    });
    user.email = data.sanitized.email;
    user.username = data.sanitized.username;
    user.firstname = data.sanitized.firstname;
    user.lastname = data.sanitized.lastname;
    // if the request comes from a staff user
    user.isActive = params.user && params.user.is_staff;
    // create user
    const createdUser = await this.sequelizeKlass
      .create(user)
      .catch(sequelizeErrorHandler);

    debug('[create] user created!', createdUser.id);
    // N.B. sequelize profile uid is the user uid.
    user.profile.provider = 'local';
    user.profile.uid = `local-${nanoid(8)}`; //= > "7hy8hvrX"
    user.profile.displayName = data.sanitized.displayName;
    user.uid = user.profile.uid;
    user.id = createdUser.id;

    await Profile.sequelize(this.sequelizeClient)
      .create({
        ...user.profile,
        user_id: createdUser.id,
      })
      .catch(sequelizeErrorHandler);
    debug(`[create] user with profile: ${user.uid} success`);
    const client = this.app.get('celeryClient');
    if (client) {
      debug(`[create] inform impresso admin to activate this user: ${user.uid}`);
      await client.run({
        task: 'impresso.tasks.after_user_registered',
        args: [user.id],
      }).catch((err) => {
        debug('Error', err);
      });
    }
    return user;
  }

  async update(id, data, params) {
    return data;
  }

  async patch(id, data, params) {
    // e.g we can change here the picture or the password
    if (data.sanitized.password && params.user.is_staff) {
      // change password directly.
      debug(`change password requested for user:${id}`);
      return this._run(this.queries.patch, {
        uid: id,
        ...encrypt(data.sanitized.password),
      }).then(res => this._finalize(res));
    }
    return {
      id,
    };
  }

  async remove(id, params) {
    if (!params.user.is_staff) {
      return { id };
    }

    // get user to be removed
    const user = await this.sequelizeKlass.scope('get').findOne({
      where: {
        [Op.or]: [{ username: id }, { '$profile.uid$': id }],
      },
    });
    if (!user) {
      return {
        id,
      };
    }
    debug(`remove: profile for ${user.username}`);
    if (user.profile) {
      await user.profile.destroy();
    }


    // no way, should be a cascade...
    debug(`remove: user ${user.username}`);
    const results = await Promise.all([
      // remove from mysql
      user.destroy().catch(sequelizeErrorHandler),
      // remove from neo4j
      // this._run(this.queries.remove, {
      //   uid: id,
      // }),
    ]);
    debug(`remove: ${user.username} success! User id ${results[0].id}`);

    // debug(`remove: ${user.username} success,
    //   sequelize: ${results[0]},
    //   neo4j: ${results[1].summary.counters._stats.nodesDeleted}`);
    // return {
    //   ...this._finalizeRemove(results[1]),
    //   removed: results[0],
    //   id,
    // };
    return {
      removed: results[0],
      id,
    };
  }

  async find(params) {
    debug('find: ', params);
    let uid;

    if (params.sanitized.githubId) {
      uid = `github-${params.sanitized.githubId}`;
    } else if (params.sanitized.email) {
      uid = params.sanitized.email;
    } else if (params.sanitized.uid) {
      uid = params.sanitized.uid;
    }

    let sequelizeParams = {};

    // e.g. during authentication process
    if (uid) {
      sequelizeParams = {
        where: {
          [Op.or]: [{ email: uid }, { username: uid }, { '$profile.uid$': uid }],
        },
      };
    }

    return this.sequelizeKlass.scope('isActive', 'find')
      .findAll(sequelizeParams)
      .then(res => res.map(d => new User(d.toJSON())));
  }
}

module.exports = function (options) {
  return new Service(options);
};

module.exports.Service = Service;
