/* eslint-disable no-unused-vars */
const Neo4jService = require('../neo4j.service').Service;
const debug = require('debug')('impresso/services:Timeline.class');

class Service extends Neo4jService {
  find (params) {
    debug(`find: with query params <using>: ${params.sanitized.using}, uid: ${params.sanitized.uid}`);
    return this._run(this.queries[params.sanitized.using], params.sanitized);
  }
}

module.exports = function (options) {
  return new Service(options);
};

module.exports.Service = Service;
