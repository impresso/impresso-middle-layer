const debug = require('debug')('impresso/services:CompositeService');
// const errors = require('@feathersjs/errors');
const Neo4jService = require('./neo4j.service').Service;

class CompositeService extends Neo4jService {
  constructor(options) {
    super(options);
  }

  async get(id, params) {
    // neo4j
    const result = await super.get(id, params);
    return result;
    // complete with information from a secondary database
  }
}

module.exports = function (options) {
  return new CompositeService(options);
};

module.exports.Service = CompositeService;
