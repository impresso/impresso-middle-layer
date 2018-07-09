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
      ... params.query,

      description: data.sanitized.description,
      name: data.sanitized.name,
      slug: slugify(data.sanitized.name).toLowerCase(),
    };

    // only staff can create buckets with specific uid
    if(params.user.is_staff && data.sanitized.bucket_uid) {
      debug(`create: staff user required bucket uid: "${data.sanitized.bucket_uid}"`);
      queryParams.bucket_uid = data.sanitized.bucket_uid
    }

    debug(`${this.name} create: `, queryParams);
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

}

module.exports = function (options) {
  return new Service(options);
};

module.exports.Service = Service;
