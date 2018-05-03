const debug = require('debug')('impresso/services:CompositeService');
// const errors = require('@feathersjs/errors');
const Neo4jService = require('./neo4j.service').Service

class CompositeService extends Neo4jService {
  constructor (options) {
    super(options)
  }

  async get (id, params) {
    const result = await super.get(id, params)
    return result;
  }
}

module.exports = function (options) {
  return new CompositeService(options);
};

module.exports.Service = CompositeService;
