const debug = require('debug')('impresso/services:buckets');
const Neo4jService = require('../neo4j.service').Service;
const slugify = require('slugify');
const { NotImplemented } = require('@feathersjs/errors');

class Service extends Neo4jService {
  async create(data, params) {
    if (Array.isArray(data)) {
      throw new NotImplemented();
      // return await Promise.all(data.map(current => this.create(current)));
    }

    const queryParams = {
      user__uid: params.user.uid,
      description: data.sanitized.description,
      name: data.sanitized.name,
      slug: slugify(data.sanitized.name).toLowerCase(),
    };

    // owner_uid is optional.
    if (data.sanitized.owner_uid && params.user.id !== data.sanitized.owner_uid) {
      // if it is not qn admin cannot create :(
      // params.user.is_staff?
      // user_uid = data.sanitized.owner_uid;
    }

    debug(`${this.name} create: `, data.sanitized);
    return this._run(this.queries.create, queryParams).then(this._finalizeCreateOne);
  }

  /**
   * async patch - description
   *
   * @param  {string} id    uid
   * @param  {object} data   description and name if any to be changed.
   * @param  {type} params description
   * @return {type}        description
   */
  async patch(id, data, params) {
    const result = await this._run(this.queries.patch, {
      user__uid: params.query.user__uid,
      uid: id,
      description: data.sanitized.description,
      name: data.sanitized.name,
    });

    return this._finalizeCreateOne(result);
  }


  /**
   * async remove - Remove a bucket permanently using neo4j DETACH DELETE
   *
   * @param  {string} id     bucket uuid
   * @param  {object} params (not used directly)
   * @return {Promise}        description
   */
  async remove(id, params) {
    const result = await this._run(this.queries.remove, {
      user__uid: params.query.user__uid,
      uid: id,
    });

    return this._finalizeRemove(result);
  }
}

module.exports = function (options) {
  return new Service(options);
};

module.exports.Service = Service;
