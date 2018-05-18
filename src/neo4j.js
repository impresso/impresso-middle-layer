const logger = require('winston');
const neo4j = require('neo4j-driver').v1;

const getNeo4jClient = (config) => {
  const driver = neo4j.driver(config.host, neo4j.auth.basic(config.auth.user, config.auth.pass), {
    connectionPoolSize: 0,
  });
  return driver;
}

module.exports = function (app) {
  logger.info(`connection to neo4j host ...`)
  const driver = getNeo4jClient(app.get('neo4j'))
  // create a session
  const session = driver.session()
  logger.info(`connection to neo4j ok!`)
  // pass neo4j session to app
  app.set('neo4jClient', session);
}

module.exports.client = getNeo4jClient;
