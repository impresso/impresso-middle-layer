const debug = require('debug')('impresso/services:buckets');
const Neo4jService = require('../neo4j.service').Service;
const slugify = require('slugify');
const { NotImplemented } = require('@feathersjs/errors');

class Service extends Neo4jService {

  async create (data, params) {
    if (Array.isArray(data)) {
      throw new NotImplemented();
      // return await Promise.all(data.map(current => this.create(current)));
    }

    const queryParams = {
      user__uid: params.user.uid,
      description: data.sanitized.description,
      name: data.sanitized.name,
      slug: slugify(data.sanitized.name).toLowerCase()
    }

    // owner_uid is optional.
    if(data.sanitized.owner_uid && params.user.id != data.sanitized.owner_uid) {
      // if it is not qn admin cannot create :(
      // params.user.is_staff?
      // user_uid = data.sanitized.owner_uid;
    }

    debug(`${this.name} create: `, data.sanitized);

    // if there's no label create a simple empty bucket.
    if(!data.sanitized.label || !Array.isArray(data.sanitized.uids)) {
      return this._run(this.queries.create, queryParams).then(this._finalize);
    }

    //const label =owner_uid
    const query = this.queries[[data.sanitized.label, 'create'].join('_')]

    return this._run(query, {
      ... queryParams,
      uids: data.sanitized.uids,

    }).then(this._finalize);
  }

  /**
   * async patch - description
   *
   * @param  {string} id    uid
   * @param  {object} data   description and name if any to be changed.
   * @param  {type} params description
   * @return {type}        description
   */
  async patch (id, data, params) {
    const queryParams = {
      user__uid: params.user.uid,
      uid: uid,
      description: data.sanitized.description,
      name: data.sanitized.name,
      uids: data.sanitized.uids
    }
    const query = this.queries[[data.sanitized.label, 'patch'].join('_')]
    return this._run(query, queryParams).then(this._finalize);
    return data;
  }

  async remove (id, params) {
    const queryParams = {
      user__uid: params.user.uid,
      uid: uid
    }



    return {id}

  }
}

module.exports = function (options) {
  return new Service(options);
};

module.exports.Service = Service;
