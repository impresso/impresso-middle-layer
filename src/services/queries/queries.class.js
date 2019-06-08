/* eslint-disable no-unused-vars */
const crypto = require('crypto');
const { NotImplemented } = require('@feathersjs/errors');
const Neo4jService = require('../neo4j.service').Service;

class Service extends Neo4jService {
  async get(id, params) {
    const result = await super.get(id, params);
    return result;
  }

  /*
  @params data: {
  "data": {"local":true},
  "name": "Articles in LeTemps",
  "parent__uid": "github-1181642-cc0a89e5da3d0c8aa783de2837826b9d"
}
  */
  async create(data, params) {
    if (Array.isArray(data)) {
      // return not available
      throw new NotImplemented('create method not available with data type: Array');
      // return await Promise.all(data.map(current => this.create(current)));
    }

    // add creator uid and JSON stringified data to hash. Cfr Validate hooks.
    // md5 signature of the data sent to the server
    const hash = crypto.createHash('md5').update(params.user.uid + data.sanitized.data).digest('hex');

    const queryParams = {
      user__uid: params.user.uid,
      uid: `${params.user.uid}-${hash}`,
      data: data.sanitized.data,
      name: data.sanitized.name,
    };
    if (data.sanitized.parent__uid) {
      queryParams.parent__uid = data.sanitized.parent__uid;
    }

    // debug creation params!
    console.log(queryParams);
    return this._run(this.queries.create, queryParams).then(this._finalize);
  }
}

module.exports = function (options) {
  return new Service(options);
};

module.exports.Service = Service;
