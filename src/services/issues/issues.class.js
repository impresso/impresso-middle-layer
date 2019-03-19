const debug = require('debug')('impresso/services:issues');
const SequelizeService = require('../sequelize.service');
const SolrService = require('../solr.service');
const Issue = require('../../models/issues.model');
const Page = require('../../models/pages.model');

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
  // eslint-disable-next-line no-unused-vars
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

      this.SequelizeService.get(id, {
        scope: 'get',
      }),

      this.SequelizeService.rawSelect({
        query: `
          SELECT pages.id as uid, pages.page_number as num, pages.has_converted_coordinates as hasCC, COUNT(ci.id) as countArticles
          FROM pages
            JOIN issues
              ON pages.issue_id = issues.id
            JOIN page_contentItem as pci
              ON pci.page_id = pages.id
            JOIN content_items as ci
              ON pci.content_item_id = ci.id
          WHERE issues.id = :id
          GROUP BY pages.id
          ORDER BY num ASC

        `,
        replacements: {
          id,
        },
      }),

      // this.Neo4jService.get(id, params),
    ]).then(results => new Issue({
      ...results[0],
      ...results[1] || {},
      pages: results[2].map(d => new Page(d)),
    }));
    return issue;
  }
}

module.exports = function (options) {
  return new Service(options);
};
module.exports.Service = Service;
