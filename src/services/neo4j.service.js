/*
  Load neo4j driver according to current configuration
*/
const neo4j = require('neo4j-driver').v1;
const debug = require('debug')('impresso/services:Neo4jService');
const {
  neo4jPrepare, neo4jRecordMapper, neo4jNow, neo4jRun, neo4jToInt,
} = require('./neo4j.utils');
const errors = require('@feathersjs/errors');

class Neo4jService {
  constructor(options) {
    this.options = options || {};
    this.config = options.config;
    this.name = options.name;
    // camelcase in options name
    // this.options.path = this.options.name.replace(/([a-zA-Z])(?=[A-Z])/g, '$1-').toLowerCase()
    if(options.app) {
      this.app = options.app;
    }

    debug(`Configuring neo4j service: ${this.options.name}`);

    this._id = this.id = options.idField || options.id || 'id';
    this._uId = options.startId || 0;

    this.driver = neo4j.driver(this.config.host, neo4j.auth.basic(this.config.auth.user, this.config.auth.pass), {
      connectionPoolSize: 0,
    });

    this.project = this.options.project || '!';
    this.queries = this.options.queries || require('decypher')(`${__dirname}/${this.options.name}/${this.options.name}.queries.cyp`);
  }

  _run(cypherQuery, params, queryname) {
    const session = this.driver.session();
    return neo4jRun(session, cypherQuery, {
      ...params,
      Project: this.config.project,
    }, queryname);
  }

  _finalizeOne(res) {
    return res.records.map(neo4jRecordMapper);
  }


  /**
   * _finalizeCreateOne - used as callback of _run for create() service method
   * Note that the `data` property in the returned obejct can be undefined.
   *
   * @param  {object} res Neo4j response
   * @return {object} custom response containing `data` and `info`.
   */
  _finalizeCreateOne(res) {
    let data;
    if (res.records.length) {
      data = neo4jRecordMapper(res.records[0]);
    }
    return {
      data,
      info: {
        resultAvailableAfter: res.summary.resultAvailableAfter.low,
        _stats: res.summary.counters._stats,
      },
    };
  }


  /**
   * _finalizeRemove - callback of _run method for remove() service method.
   *
   * @param  {object} res Neo4j response
   * @return {object}     description
   */
  _finalizeRemove(res) {
    return {
      info: {
        resultAvailableAfter: res.summary.resultAvailableAfter.low,
        _stats: res.summary.counters._stats,
      },
    };
  }

  // add
  static wrap(data, limit, skip, total, info) {
    return {
      data,
      limit,
      skip,
      total,
      info,
    };
  }

  _finalizeCreate(res) {
    return {
      data: res.records.map(neo4jRecordMapper),
      info: {
        resultAvailableAfter: res.summary.resultAvailableAfter.low,
        _stats: res.summary.counters._stats,
      },
    };
  }

  _finalize(res) {
    // add "total" field to extra. This enables next and prev.
    // console.log(res.records, res.records[0])
    let count;


    debug('_finalize: resultAvailableAfter', neo4jToInt(res.summary.resultAvailableAfter), 'ms');
    if (Array.isArray(res.records)) {
      if (res.records.length) {
        const record = res.records[0];
        debug('_finalize: record._fieldLookup:', record._fieldLookup);
        if (record._fieldLookup) {
          const countidx = record._fieldLookup._total;

          if (typeof countidx === 'number') {
            count = neo4jToInt(record._fields[countidx]);
          }
        }
      } else {
        return Neo4jService.wrap(
          [],
          res.queryParams ? res.queryParams.limit : null,
          res.queryParams ? res.queryParams.skip : null,
          0,
        );
      }
    }

    if (typeof count !== 'undefined') {
      debug('_finalize: count property has been found, <count>:', count);

      return Neo4jService.wrap(
        res.records.map(neo4jRecordMapper),
        res.queryParams ? res.queryParams.limit : null,
        res.queryParams ? res.queryParams.skip : null,
        count,
        // res.summary.counters._stats
      );
    }
    debug('_finalize: no count has been found.');
    return res.records.map(neo4jRecordMapper);
  }


  async find(params) {
    debug(`find: with params.isSafe:${params.isSafe} and params.query:`, params.query);
    return this._run(this.queries.find, params.isSafe ? params.query : params.sanitized).then(this._finalize);
  }

  async get(id, params) {
    debug(`get: ${this.name} with id:${id} and params.isSafe:${params.isSafe} and params.query:`, params.query);
    const uids = id.split(',');

    // query params
    let query;
    let queryname;

    const qp = {
      ...params.isSafe ? params.query : params.sanitized,
    };

    if(params.user) {
      qp._exec_user_uid = params.user.uid;
      qp._exec_user_is_staff = params.user.is_staff;
    }

    if (uids.length > 1 || params.findAll) {
      qp.uids = uids;
      query = this.queries.findAll;
      queryname = `${this.name}.queries.cyp:findAll`
    } else if (id == '*') {
      query = this.queries.findAllWildcard;
      queryname = `${this.name}.queries.cyp:findAllWildcard`
    } else {
      query = this.queries.get;
      queryname = `${this.name}.queries.cyp:get`
      qp.uid = id;
    }

    if (!query) {
      throw new errors.NotImplemented();
    }

    return this._run(query, qp, queryname).then(this._finalize).then((records) => {
      if (!records.length) {
        throw new errors.NotFound();
      }
      if (records.length == 1 && !params.findAll) {
        return records[0];
      }
      return records;
    });
  }

  async remove(id, params) {
    if (!this.queries.remove) {
      throw new errors.NotImplemented();
    } else if (!params.user.uid) {
      throw new errors.NotAuthenticated();
    }
    debug(`remove: ${this.name} with id: ${id}`, id);

    return this._run(this.queries.remove, {
      uid: id,
      ...params.isSafe ? params.query : params.sanitized,
      _exec_user_uid: params.user.uid,
    }).then((res) => {
      debug('remove: neo4j response', res);
      // console.log(res.summary.counters);
      // if(!records.length) {
      //   throw new errors.NotFound()
      // }
      // return records[0]
      return res.summary.counters._stats;
    });
  }
}

module.exports = function (options) {
  return new Neo4jService(options);
};

module.exports.Service = Neo4jService;
