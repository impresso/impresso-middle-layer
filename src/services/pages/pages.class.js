/* eslint-disable no-unused-vars */
const debug = require('debug')('impresso/services:pages');
const { NotFound } = require('@feathersjs/errors');
const Neo4jService = require('../neo4j.service').Service;
const solr = require('../../solr');
const Article = require('../../models/articles.model');
const Page = require('../../models/pages.model');

class Service extends Neo4jService {
  constructor(options) {
    super(options);
    this.solr = solr.client(options.app.get('solr'));
  }

  async get(id, params) {
    const results = await Promise.all([
      // we perform a solr request to get basic info on the page:
      // number of articles,
      this.solr.findAll({
        q: `page_id_ss:${id}`,
        fl: Article.ARTICLE_SOLR_FL_MINIMAL,
      }),
      // at the same time, we use the neo4jService get to get article instance from our graph db
      // user tags, user collections and public collections
      super.get(id, {
        ...params,
        findAll: true,
      }),
      // get from db
    ]);

    if (results[0].response.numFound === 0) {
      debug(`get: no articles found for page id ${id}`);
      throw new NotFound();
    }
    // initialize page after solr
    return new Page({
      uid: id,
      countArticles: results[0].response.numFound,
    }, true);
  }
}

module.exports = function (options) {
  return new Service(options);
};

module.exports.Service = Service;
