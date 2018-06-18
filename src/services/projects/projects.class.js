const Neo4jService = require('../neo4j.service').Service;

class Service extends Neo4jService {

}

module.exports = function (options) {
  return new Service(options);
};

module.exports.Service = Service;
