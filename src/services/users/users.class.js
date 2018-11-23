/* eslint-disable no-unused-vars */
const debug = require('debug')('impresso/services:users');
const { neo4jRecordMapper } = require('../neo4j.utils.js');
const Neo4jService = require('../neo4j.service').Service;
const { BadRequest, NotFound } = require('@feathersjs/errors');
const { encrypt } = require('../../crypto');
const shorthash = require('short-hash');
const sequelize = require('../../sequelize');
const User = require('../../models/users.model');


class Service extends Neo4jService {
  constructor(options) {
    super(options);
    const sequelizeConfig = options.app.get('sequelize');
    // sequelize
    this.sequelize = sequelize.client(sequelizeConfig);
    this.sequelizeKlass = User.sequelize(this.sequelize, {
      tableName: sequelizeConfig.tables.users,
    });
    console.log(this.sequelizeKlass);
  }

  async get(id, params) {
    // if you're staff; otherwise get your own.
    const user = await this.sequelizeKlass.scope('isActive', 'get').findOne({
      where: {
        '$profile.uid$': id,
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
    // create multiple only if user is admin @todo!
    // if (Array.isArray(data)) {
    //   return await Promise.all(data.map(current => this.create(current)));
    // }
    // get github id!
    // console.log('create user:',data, params)
    const user = new User();
    if(data.sanitized.email && data.sanitized.password && data.sanitized.username) {
      user.password = User.buildPassword(data.sanitized.password);
      console.log(user);
      const created = await this.sequelizeKlass.create(user);
      //
      //   .then(function(u) {
  		// user = u;
      //
  		// return Profile.create({
  		// 	someData: 'data here'
  		// });
    	// }).then(function(profile) {
    	// 	user.setProfile(profile)
    	// })
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
    // const result = this._run(this.queries.create, {
    //   ...data.sanitized,
    //   ...user,
    // }).then(res =>
    //   // console.log(res.records, res);
    //   res.records.map(neo4jRecordMapper).map(d => ({
    //     ...d,
    //     id: d.id,
    //   })));
    //
    // return result;
    // return data;
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
    const result = await this._run(this.queries.remove, {
      uid: id,
    });
    debug('remove:', id, 'stats:', result.summary.counters._stats);
    return this._finalizeRemove(result);
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
          $or: [{ email: uid }, { username: uid }, { '$profile.uid$': uid }],
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
