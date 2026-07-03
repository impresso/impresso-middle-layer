import { getLogger } from '@/logger.js'
const logger = getLogger(['impresso', 'neo4j'])
import { v1 as neo4j } from 'neo4j-driver'

const getNeo4jClient = config => {
  const driver = neo4j.driver(config.host, neo4j.auth.basic(config.auth.user, config.auth.pass), {
    connectionPoolSize: 0,
  })
  return driver
}

export default function (app) {
  const config = app.get('neo4j')
  if (!config || !config.host) {
    logger.debug('Neo4j is not configured.')
    return
  }

  logger.debug(`Neo4j configuration found, host:${config.host}, let's see if it works...`)

  const driver = getNeo4jClient(config)
  // create a session
  const session = driver.session()
  app.set('neo4jClient', session)

  // test query with neo4j
  session
    .run('RETURN 1 + 1')
    .then(res => {
      logger.debug(`Neo4j is ready! version: ${res.summary.server.version}`)
      // pass neo4j session to app
    })
    .catch(err => {
      logger.debug(`Neo4j connection error! ${err.code}`)
    })
}

export const client = getNeo4jClient
