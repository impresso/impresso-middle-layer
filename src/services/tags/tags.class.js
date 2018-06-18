/* eslint-disable no-unused-vars */
const Neo4jService = require('../neo4j.service').Service;

class Service extends Neo4jService {
  async create(data, params) {
    if (Array.isArray(data)) {
      return await Promise.all(data.map(current => this.create(current)));
    }

    return data;
  }
}

module.exports = function (options) {
  return new Service(options);
};

module.exports.Service = Service;
