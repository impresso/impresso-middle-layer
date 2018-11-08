/* eslint-disable no-unused-vars */
const debug = require('debug')('impresso/services:users');
const { neo4jRecordMapper } = require('../neo4j.utils.js');
const Neo4jService = require('../neo4j.service').Service;
const errors = require('@feathersjs/errors');
const { encrypt } = require('../../crypto');
const shorthash = require('short-hash');

class Service extends Neo4jService {
  async create(data, params) {
    // create multiple only if user is admin @todo!
    // if (Array.isArray(data)) {
    //   return await Promise.all(data.map(current => this.create(current)));
    // }
    // get github id!
    // console.log('create user:',data, params)
    const user = {};

    if (params.oauth && params.oauth.provider === 'github' && data.github) {
      // github oauth success, the github object is filled with interesting data.
      user.uid = `github-${data.githubId}`;
      user.provider = 'github';
      user.username = data.github.profile.username;
      user.password = '';
      user.displayname = data.github.profile.displayName;
      user.picture = data.github.profile.photos.map(d => d.value);
    } else if (data.sanitized.email && data.sanitized.password && data.sanitized.username) {
      user.uid = `local-${shorthash(data.sanitized.username)}`; // uid is enforced
      user.provider = 'local';
      user.username = data.sanitized.username;
      Object.assign(user, encrypt(data.sanitized.password));
    } else {
      throw new errors.BadRequest({
        message: 'MissingParameters',
      });
    }

    const result = this._run(this.queries.create, {
      ...data.sanitized,
      ...user,
    }).then((res) => {
      console.log(res.records, res);
      return res.records.map(neo4jRecordMapper).map(d => ({
        ...d,
        id: d.id,
      }));
    });

    return result;
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

    let uid;

    if (params.sanitized.githubId) {
      uid = `github-${params.sanitized.githubId}`;
    } else if (params.sanitized.email) {
      uid = params.sanitized.email;
    }
    const result = await this._run(this.queries.find, {
      ...params.query,
      uid,
      user_uid: userUid,
    }).then(res =>
      // add id field for oauth2. @todo change somewhere in config
      res.records.map(neo4jRecordMapper).map(u => ({
        ...u,
        id: u.uid,
      })));
    return result;
  }
}

module.exports = function (options) {
  return new Service(options);
};

module.exports.Service = Service;
