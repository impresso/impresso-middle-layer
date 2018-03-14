/*
  Load neo4j driver according to current configuration
*/
const neo4j = require('neo4j-driver').v1;
const {neo4jPrepare, neo4jRecordMapper, neo4jNow, neo4jToInt} = require('./neo4j.utils');
const errors = require('@feathersjs/errors');

class Neo4jService {
  constructor (options) {

    this.options = options || {};
    this.config  = options.config;

    console.log(`Configuring neo4j service: ${this.options.name}`);

    this._id = this.id = options.idField || options.id || 'id';
    this._uId = options.startId || 0;

    this.driver = neo4j.driver(this.config.host, neo4j.auth.basic(this.config.auth.user, this.config.auth.pass),{
      connectionPoolSize: 0
    });
    this.project = this.options.project || '!';
    this.queries = this.options.queries || {};
  }

  _run(cypherQuery, params) {
    let session = this.driver.session()
    // console.log('Neo4jService _run with:', neo4jPrepare(cypherQuery, params))
    return session.run(neo4jPrepare(cypherQuery, params), {
      Project: this.config.project,
      ... neo4jNow(),
      ... params
    }).then( res => {
      session.close();
      return res
    });
  }

  _finalize (res) {
    // add "total" field to extra. This enables next and prev.
    let count;
    if(res.records.length && res.records[0]._fieldLookup.total && res.records[0]._fields[res.records[0]._fieldLookup.total]) {
      count = neo4jToInt(res.records[0]._fields[res.records[0]._fieldLookup.total]);
    }
    if(typeof count != 'undefined'){
      return {
        // params: params,
        count: count,
        records: res.records.map(neo4jRecordMapper)
      }
    } else {
      console.log('no count has been found.')
      return res.records.map(neo4jRecordMapper);
    }
  }

  find (params) {
    return this._run(this.queries.find, params.sanitized).then(this._finalize)
  }

  get (id, params) {
    return this._run(this.queries.get, {
      uid: id,
      ... params.sanitized
    }).then(this._finalize)
  }
}

module.exports = function (options) {
  return new Neo4jService(options);
};

module.exports.Service = Neo4jService;
