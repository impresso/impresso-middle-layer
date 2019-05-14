/* eslint-disable no-unused-vars */
const debug = require('debug')('impresso/services:pages');
const { NotFound } = require('@feathersjs/errors');
const solr = require('../../solr');
const SequelizeService = require('../sequelize.service');
const Article = require('../../models/articles.model');
const Page = require('../../models/pages.model');

class Service {
  constructor({
    app,
    name,
  }) {
    this.name = name;
    this.solrClient = app.get('solrClient');
    this.SequelizeService = SequelizeService({
      app,
      name,
    });
  }

  async get(id, params) {
    const results = await Promise.all([
      // we perform a solr request to get basic info on the page:
      // number of articles,
      this.solrClient.findAll({
        q: `page_id_ss:${id}`,
        fl: Article.ARTICLE_SOLR_FL_MINIMAL,
      }),
      // mysql stuff
      this.SequelizeService.get(id, {}),
    ]);

    if (results[0].response.numFound === 0) {
      debug(`get: no articles found for page id ${id}`);
      throw new NotFound();
    }
    // initialize page after solr
    results[1].countArticles = results[0].response.numFound;
    return results[1];
  }

  async find(params) {
    return this.SequelizeService.find(params);
  }
}

module.exports = function (options) {
  return new Service(options);
};

module.exports.Service = Service;
