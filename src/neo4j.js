const logger = require('winston');
const neo4j = require('neo4j-driver').v1;

module.exports = function (app) {
  const config = app.get('neo4j');
  logger.info(`connection to neo4j host ...`)
  const driver = neo4j.driver(config.host, neo4j.auth.basic(config.auth.user, config.auth.pass),{
    connectionPoolSize: 0
  });
  // create a session
  const session = driver.session()

  logger.info(`connection to neo4j ok!`)

  // pass neo4j session to app
  app.set('neo4jClient', session);
}
