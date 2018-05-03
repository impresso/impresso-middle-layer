/* eslint-disable no-unused-vars */
const CompositeService = require('../neo4j.service').Service;

class Service extends CompositeService {
  
}

module.exports = function (options) {
  return new Service(options);
};

module.exports.Service = Service;
