const neo4j = require('neo4j-driver').v1;
const {neo4jPrepare} = require('../../services/neo4j.utils');

// usage example: TASK=run_query QUERIES=./src/services/newspapers/newspapers.queries.cyp NAME=count npm run cli

module.exports = [

  (app, log, next) => {
    const config = app.get('neo4j');
    const driver = neo4j.driver(config.host, neo4j.auth.basic(config.auth.user, config.auth.pass),{
      connectionPoolSize: 0
    });
    const session  = driver.session()

    if(!process.env.QUERIES){
      log._help('missing QUERY env param:\n TASK=run_query QUERIES=<../path/to/query.cyp> NAME=<cypher query to execute> npm run cli');
      next('exit with errors.')
      return;
    }
    if(!process.env.NAME){
      log._help('missing NAME env param:\n TASK=run_query QUERIES=<../path/to/query.cyp> NAME=<cypher query to execute> npm run cli');
      next('exit with errors.')
      return;
    }

    const queries = require('decypher')(process.env.QUERIES);
    
    if(!queries[process.env.NAME]) {
      next(`specified query ${process.env.name} has not been found`);
      return
    }

    console.log(log._ye('executing query\n'), queries[process.env.NAME]);
    
    session.writeTransaction(tx => {
      tx.run(queries[process.env.NAME], {Project: config.project});
    }).then(res => {
      next(null, session, driver);
    }).catch(next);
  },

  (session, driver, next) => {
    session.close()
    driver.close()
    setImmediate(next);
  }
]
