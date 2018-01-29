/*
  Load neo4j driver according to current configuration
*/
const neo4j = require('neo4j-driver').v1;
const {neo4jPrepare} = require('./neo4j.utils');

class Neo4jService {
  constructor (options) {
    this.options = options || {};
    this.config  = options.config;

    console.log('Configuring neo4j service: ', this.options.name);
    
    this.driver = neo4j.driver(this.config.host, neo4j.auth.basic(this.config.auth.user, this.config.auth.pass),{
      connectionPoolSize: 0
    });
    this.project = this.options.project || '!';
    this.queries = this.options.queries || {};
  }

  _run(cypherQuery, params) {
    let session = this.driver.session()
    console.log('Neo4jService _run with:', neo4jPrepare(cypherQuery, params))
    return session.run(neo4jPrepare(cypherQuery, params), {
      Project: this.config.project,
      ... params
    }).then( res => {
      session.close();
      return res
    });
  }

  find (params) {
    return this._run(this.queries.find, params.sanitized)
  }

  get (id, params) {
    return this._run(this.queries.get, {
      uid: id,
      ... params.sanitized
    })
  }
}

module.exports = function (options) {
  return new Neo4jService(options);
};

module.exports.Service = Neo4jService;
