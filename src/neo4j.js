/*
  Load neo4j driver according to current configuration
*/
const neo4j         = require('neo4j-driver').v1;
      

module.exports = function () {
  const app = this;

  const config = app.get('neo4j'),
        driver        = neo4j.driver(config.host, neo4j.auth.basic(config.auth.user, config.auth.pass)),
        session       = driver.session()
  
  const runner = (cypherQuery, params) => {
    return session.run(cypherQuery, {
      Project: config.project,
      ... params
    })
    // @todo
    // .catch(err => {
    //   console.log('err', err);
    // })
  }


  // app.set('neo4jSession', session);
  // app.set('neo4jProject', config.project);
  app.set('neo4jSessionRunner', runner);

  app.setup = function (...args) {

  };
};
