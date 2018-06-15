/* eslint-disable no-unused-vars */
const debug = require('debug')('impresso/services:search');
const { neo4jRun, neo4jRecordMapper, neo4jSummary } = require('../neo4j.utils');

class Service {
  /**
   * Search service. According to group, deliver a different thing.
   *
   * Add solr
   * @param  {object} options pass the current app in options.app
   */
  constructor (options) {
    this.solr = require('../../solr').client(options.app.get('solr'));
    this.neo4j = require('../../neo4j').client(options.app.get('neo4j'));
    this.name = options.name;
    this.neo4jQueries = {};
    this.neo4jQueries.articles = require('decypher')(`${__dirname}/../articles/articles.queries.cyp`);
    this.neo4jQueries.pages = require('decypher')(`${__dirname}/../pages/pages.queries.cyp`);

    this.options = options || {};
  }

  static wrap(data, limit, skip, total, info) {
    return {
      data,
      limit,
      skip,
      total,
      info
    }
  }


  /**
   * async find - generic /search endpoint, this method gets matches from solr
   * and map the results with articles or pages.
   *
   * @param  {object} params query params. Check hhooks
   */
  async find (params) {
    // mapped objects
    let results = [];
    let uids = [];

    debug(`find '${this.name}': query:`, params.query);


    // TODO: transform params.query.filters to match solr syntax
    const _solr = await this.solr.findAll({
      q: params.query.sq,
      facets: params.query.facets,
      limit: params.query.limit,
      skip: params.query.skip
    });

    const total = _solr.response.numFound;


    debug(`find '${this.name}': SOLR found ${total} using params.query:`,  params.query);

    if(!total) {
      return Service.wrap([], params.query.limit, params.query.skip, total);
    }

    const session = this.neo4j.session()

    const itemsFromNeo4j = await neo4jRun(session, this.neo4jQueries[params.query.group_by].findAll, {
      Project: 'impresso',
      uids: _solr.response.docs.map(d => d.uid)
    }).then((res) => {
      let _records = {}
      debug(`find '${this.name}': neo4j success`, neo4jSummary(res));
      for(let rec of res.records) {
        rec = neo4jRecordMapper(rec);
        _records[rec.uid] = rec;
      }
      return _records;
    }).catch(err => {
      console.log(err);
      return {}
    })

    // merge results maintaining solr ordering.
    results = _solr.response.docs.map(d => {
      return {
        ... d,
        ... itemsFromNeo4j[d.uid] || {},
      }
    });

    return Service.wrap(results, params.query.limit, params.query.skip, total, {
      responseTime: {
        solr: _solr.responseHeader.QTime
      },
      facets: _solr.facets
    });
  }


}

module.exports = function (options) {
  return new Service(options);
};

module.exports.Service = Service;
