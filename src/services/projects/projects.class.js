import { Neo4jService } from '@/services/neo4j.service.js'

/**
 * @deprecated
 */
export class Service extends Neo4jService { }

export default async function (options) {
  return new Service(options)
}
