const debug = require('debug')('impresso/neo4j');
const neo4j = require('neo4j-driver').v1;

const getNeo4jClient = (config) => {
  const driver = neo4j.driver(config.host, neo4j.auth.basic(config.auth.user, config.auth.pass), {
    connectionPoolSize: 0,
  });
  return driver;
};

module.exports = function (app) {
  const config = app.get('neo4j');
  if (!config || !config.host) {
    debug('Neo4j is not configured.');
    return;
  }

  debug(`Neo4j configuration found, host:${config.host}, let's see if it works...`);

  const driver = getNeo4jClient(config);
  // create a session
  const session = driver.session();
  app.set('neo4jClient', session);

  // test query with neo4j
  session.run('RETURN 1 + 1').then((res) => {
    debug(`Neo4j is ready! version: ${res.summary.server.version}`);
    // pass neo4j session to app
  }).catch((err) => {
    debug(`Neo4j connection error! ${err.code}`);
  });
};

module.exports.client = getNeo4jClient;
