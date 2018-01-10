/*
  Load neo4j driver according to current configuration
*/
const neo4j         = require('neo4j-driver').v1;
      

module.exports = function () {
  const app = this;

  const config = app.get('neo4j'),
        driver = neo4j.driver(config.host, neo4j.auth.basic(config.auth.user, config.auth.pass),{
          connectionPoolSize: 0
        });
        
  
  const runner = (cypherQuery, params) => {
    let session = driver.session()

    return session.run(cypherQuery, {
      Project: config.project,
      ... params
    }).then( res => {
      session.close();
      return res
    });
  }

  app.set('neo4jSessionRunner', runner);

  app.setup = function (...args) {

  };
};
