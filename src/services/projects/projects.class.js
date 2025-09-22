// import { Neo4jService as Service } from '../neo4j.service'

/**
 * @deprecated
 */
export class Service extends Neo4jService { }

export default function (options) {
  return new Service(options)
}
