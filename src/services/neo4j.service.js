/*
  Load neo4j driver according to current configuration
*/
const neo4j = require('neo4j-driver').v1;

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

    return session.run(cypherQuery, {
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
