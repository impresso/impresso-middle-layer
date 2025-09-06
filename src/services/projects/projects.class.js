const Neo4jService = require('../neo4j.service').Service

/**
 * @deprecated
 */
class Service extends Neo4jService {}

export default function (options) {
  return new Service(options)
}

export const Service = Service
