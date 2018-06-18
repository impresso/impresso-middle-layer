const debug = require('debug')('impresso/services:FusionService');
const { NotFound } = require('@feathersjs/errors');
const { neo4jRun, neo4jRecordMapper, neo4jSummary } = require('./neo4j.utils');

class FusionService {
  constructor(options) {
    this.sequelize = require('../sequelize').client(options.app.get('sequelize'));
    this.neo4j = require('../neo4j').client(options.app.get('neo4j'));

    // then solr when is ready.
    this.neo4jQueries = require('decypher')(`${__dirname}/${options.name}/${options.name}.queries.cyp`);
    this.sequelizeKlass = require(`../models/${options.name}.model`).model(this.sequelize);

    this.name = options.name;
    debug(`Configuring service: ${options.name}`);
  }

  async get(id, params) {
    // neo4j
    // get newspaper, purely.
    const itemFromSequelize = await this.sequelizeKlass.scope('get').findById(id);

    if (!itemFromSequelize) {
      debug(`get '${this.name}': uid not found <uid>:`, id);
      throw new NotFound();
    }
    const session = this.neo4j.session();

    const itemFromNeo4j = await neo4jRun(session, this.neo4jQueries.get, {
      Project: 'impresso',
      uid: itemFromSequelize.uid,
    }).then((res) => {
      debug(`get '${this.name}': neo4j success`, neo4jSummary(res));
      if (!Array.isArray(res.records) || !res.records.length) {
        throw new NotFound();
      }
      return neo4jRecordMapper(res.records[0]);
    });

    return {
      ...itemFromSequelize.toJSON(),
      ...itemFromNeo4j,
    };
  }

  async find(params) {
    debug(`find '${this.name}': with params.isSafe:${params.isSafe} and params.query:`, params.query);
    const session = this.neo4j.session();
    // pure findAll, limit and offset only
    const itemsFromSequelize = await this.sequelizeKlass.scope('findAll').findAll({
      offset: params.query.skip,
      limit: params.query.limit,
    });


    // console.log(itemsFromSequelize.map(d => d.dataValues));
    // enrich with network data
    const itemsFromNeo4j = await neo4jRun(session, this.neo4jQueries.findAll, {
      Project: 'impresso',
      uids: itemsFromSequelize.map(d => d.uid),
    }).then((res) => {
      const _records = {};
      debug(`find '${this.name}': neo4j success`, neo4jSummary(res));
      for (let rec of res.records) {
        rec = neo4jRecordMapper(rec);
        _records[rec.uid] = rec;
      }
      return _records;
    });

    // merge result magically.
    const results = itemsFromSequelize.map(d => ({
      ...itemsFromNeo4j[d.uid],
      ...d.toJSON(),
    }));

    return FusionService.wrap(results, params.query.limit, params.query.skip, 0);
  }

  static wrap(data, limit, skip, total, info) {
    return {
      data,
      limit,
      skip,
      total,
      info,
    };
  }
}

module.exports = function (options) {
  return new FusionService(options);
};

module.exports.Service = FusionService;
