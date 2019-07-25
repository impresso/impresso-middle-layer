/* eslint-disable no-unused-vars */
const debug = require('debug')('impresso/services:users');
const { neo4jRecordMapper } = require('../neo4j.utils.js');
const Neo4jService = require('../neo4j.service').Service;
const { BadRequest, NotFound } = require('@feathersjs/errors');
const { encrypt } = require('../../crypto');
const shorthash = require('short-hash');
const nanoid = require('nanoid');
const sequelize = require('../../sequelize');
const { Op } = require('sequelize');
const { sequelizeErrorHandler } = require('../../services/sequelize.utils');
const User = require('../../models/users.model');
const Profile = require('../../models/profiles.model');

class Service extends Neo4jService {
  constructor(options) {
    super(options);
    const config = options.app.get('sequelize');
    // sequelize
    this.sequelize = sequelize.client(config);
    this.sequelizeKlass = User.sequelize(this.sequelize, config);
  }

  async get(id, params) {
    // if you're staff; otherwise get your own.
    const user = await this.sequelizeKlass.scope('isActive', 'get').findOne({
      where: {
        [Op.or]: [{ username: id }, { '$profile.uid$': id }],
      },
    });
    if (!user) {
      debug(`get '${this.name}': uid not found <uid>:`, id);
      throw new NotFound();
    } else {
      return new User(user.toJSON());
    }
  }

  async create(data, params) {
    // prepare empty user.
    const user = new User();
    // case 1:
    if (data.sanitized.email && data.sanitized.password && data.sanitized.username) {
      user.password = User.buildPassword({
        password: data.sanitized.password,
      });
      user.email = data.sanitized.email;
      user.username = data.sanitized.username;
      user.isActive = !!(params && params.user && params.user.is_staff);

      // create user
      const createdUser = await this.sequelizeKlass
        .create(user)
        .catch(sequelizeErrorHandler);

      debug('create: user created!', createdUser.id);
      // N.B. sequelize profile uid is the user uid.
      user.profile.provider = 'local';
      user.profile.uid = `local-${nanoid(8)}`; //= > "7hy8hvrX"
      user.uid = user.profile.uid;
      user.id = createdUser.id;

      await Profile.sequelize(this.sequelize)
        .create({
          ...user.profile,
          user_id: createdUser.id,
        })
        .catch(sequelizeErrorHandler);

      // await this._run(this.queries.create, {
      //   ...data.sanitized,
      //   ...user,
      //   provider: user.profile.provider,
      // }).then(res =>
      // // console.log(res.records, res);
      //   res.records.map(neo4jRecordMapper).map(d => ({
      //     ...d,
      //     id: d.id,
      //   })));

      debug(`create user: ${user.uid} success`);
    }
    // if (params.oauth && params.oauth.provider === 'github' && data.github) {
    //   // github oauth success, the github object is filled with interesting data.
    //   user.uid = `github-${data.githubId}`;
    //   user.provider = 'github';
    //   user.username = data.github.profile.username;
    //   user.password = '';
    //   user.displayname = data.github.profile.displayName;
    //   user.picture = data.github.profile.photos.map(d => d.value);
    // } else if (data.sanitized.email && data.sanitized.password && data.sanitized.username) {
    //   user.uid = `local-${shorthash(data.sanitized.username)}`; // uid is enforced
    //   user.provider = 'local';
    //   user.username = data.sanitized.username;
    //   Object.assign(user, encrypt(data.sanitized.password));
    // } else {
    //   throw new BadRequest({
    //     message: 'MissingParameters',
    //   });
    // }
    //


    //
    // return result;
    // return data;
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
    const userUid = params.authenticated ? params.user.uid : undefined;
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
    // const results = await Promise.all([
    //   // look for username or email or profile uid (sooo cool!)
    //
    //   // neo4j!
    //   this._run(this.queries.find, {
    //     ...params.query,
    //     uid,
    //     user_uid: userUid,
    //   }).then(res =>
    //     // add id field for oauth2. @todo change somewhere in config
    //     res.records.map(neo4jRecordMapper).map(u => ({
    //       ...u,
    //       id: u.uid,
    //   }))),
    // ]);
    //
    // if(results[1]) {
    //
    // }
    // console.log(results);
    // return results[0];
  }
}

module.exports = function (options) {
  return new Service(options);
};

module.exports.Service = Service;
