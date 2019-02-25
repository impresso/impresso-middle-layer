const debug = require('debug')('impresso/services:newspapers');
const SequelizeService = require('../sequelize.service');
const SolrService = require('../solr.service');
const Neo4jService = require('../neo4j.service');

const Issue = require('../../models/issues.model');

class Service {
  constructor({
    app,
    name = '',
  } = {}) {
    this.name = String(name);
    this.app = app;
    this.SequelizeService = SequelizeService({
      app,
      name,
    });
    this.Neo4jService = Neo4jService({
      app,
      name,
    });
    this.SolrService = SolrService({
      app,
      name,
      namespace: 'search',
    });
  }

  async find(params) {
    debug(`find '${this.name}': with params.isSafe:${params.isSafe} and params.query:`, params.query);
    const results = await this.SolrService.find({
      ...params,
      fl: Issue.ISSUE_SOLR_FL_MINIMAL,
      collapse_by: 'meta_issue_id_s',
      // get first ARTICLE result
      collapse_fn: 'sort=\'id ASC\'',
    });
    // add SequelizeService to load Newspaper properly.
    return results;
  }

  async get(id, params) {
    const issue = await Promise.all([
      // we perform a solr request to get
      // the full text, regions of the specified article
      this.SolrService.find({
        query: {
          limit: 1,
          skip: 0,
        },
        q: `meta_issue_id_s:${id}`,
        fl: Issue.ISSUE_SOLR_FL_MINIMAL,
        collapse_by: 'meta_issue_id_s',
        // get first ARTICLE result
        collapse_fn: 'sort=\'id ASC\'',
      }).then(res => res.data[0]),
      this.Neo4jService.get(id, params),
    ]).then(results => ({
      ...results[0],
      ...results[1] || {},
    }));
    return issue;
  }
}

module.exports = function (options) {
  return new Service(options);
};
module.exports.Service = Service;
