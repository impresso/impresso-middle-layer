/*
  Load neo4j driver according to current configuration
*/
const neo4j = require('neo4j-driver').v1;
const debug = require('debug')('impresso/services:Neo4jService');
const {neo4jPrepare, neo4jRecordMapper, neo4jNow, neo4jToInt} = require('./neo4j.utils');
const errors = require('@feathersjs/errors');

class Neo4jService {
  constructor (options) {

    this.options = options || {};
    this.config  = options.config;

    debug(`Configuring neo4j service: ${this.options.name}`);

    this._id = this.id = options.idField || options.id || 'id';
    this._uId = options.startId || 0;

    this.driver = neo4j.driver(this.config.host, neo4j.auth.basic(this.config.auth.user, this.config.auth.pass),{
      connectionPoolSize: 0
    });

    this.project = this.options.project || '!';
    this.queries = this.options.queries || require('decypher')(`${__dirname}/${this.options.name}/${this.options.name}.queries.cyp`);
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
    }).catch( err => {
      if(err.code == 'Neo.ClientError.Schema.ConstraintValidationFailed'){
        debug(`Neo.ClientError.Statement.ParameterMissing: ${err}`);
        throw new errors.Conflict('ConstraintValidationFailed')
      } else if(err.code == 'Neo.ClientError.Statement.ParameterMissing'){
        debug('Neo.ClientError.Statement.ParameterMissing:',err)
        throw new errors.BadRequest('ParameterMissing')
      } else {
        console.error(err);
      }
      throw new errors.BadRequest()
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
        records: count > 0 ? res.records.map(neo4jRecordMapper): []
      }
    } else {
      debug('_finalize: no count has been found.')
      return res.records.map(neo4jRecordMapper);
    }
  }


  async find (params) {
    debug(`find: with params.isSafe:${params.isSafe} and params.query:`,  params.query);
    return this._run(this.queries.find, params.isSafe? params.query: params.sanitized).then(this._finalize)
  }

  async get (id, params) {
    debug(`get: with id:${id} and params.query ${params.query} and params.isSafe:${params.isSafe}`);
    return this._run(this.queries.get, {
      uid: id,
      ... params.isSafe? params.query: params.sanitized
    }).then(this._finalize).then(records => {

      if(!records.length) {
        throw new errors.NotFound()
      }
      return records[0]
    })
  }

  async remove (id, params) {
    debug(`remove: with id:${id}`, id);
    return this._run(this.queries.remove, {
      uid: id,
      ... params.isSafe? params.query: params.sanitized
    }).then(res => {
      debug('remove: neo4j response', res)
      // console.log(res.summary.counters);
      // if(!records.length) {
      //   throw new errors.NotFound()
      // }
      // return records[0]
      return res.summary.counters._stats
    })
  }
}

module.exports = function (options) {
  return new Neo4jService(options);
};

module.exports.Service = Neo4jService;
