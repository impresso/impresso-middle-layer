/*
  Load neo4j driver according to current configuration
*/
const neo4j         = require('neo4j-driver').v1;
      

module.exports = function () {
  const app = this;

  const config = app.get('neo4j'),
        driver        = neo4j.driver(config.host, neo4j.auth.basic(config.auth.user, config.auth.pass)),
        session       = driver.session()
  
  app.set('neo4jSession', session);
  app.set('neo4jProject', config.project);

  app.setup = function (...args) {

  };
};
