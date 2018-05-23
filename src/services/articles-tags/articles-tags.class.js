/* eslint-disable no-unused-vars */
const Neo4jService = require('../neo4j.service').Service;
const shash = require('short-hash');
const { NotImplemented } = require('@feathersjs/errors');

class Service extends Neo4jService {

  async create (data, params) {
    const _type = 'create-articles-tags';
    const _uid = shash(`${params.query.user__uid}:${_type}:${data.sanitized.article__uid}:${data.sanitized.tag__uid}`);

    const result = await this._run(this.queries.merge, {
      user__uid: params.query.user__uid,
      article__uid: data.sanitized.article__uid,
      tag__uid: data.sanitized.tag__uid,
      type: _type,
      _uid: _uid
    });
    
    return this._finalizeCreate(result);
  }

  async find (params) {
    throw new NotImplemented();
  }
}

module.exports = function (options) {
  return new Service(options);
};

module.exports.Service = Service;
