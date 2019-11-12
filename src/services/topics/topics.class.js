/* eslint-disable no-unused-vars */
const debug = require('debug')('impresso/services/topics');
const { NotFound } = require('@feathersjs/errors');

const SequelizeService = require('../sequelize.service');
const SolrService = require('../solr.service');

class Service {
  constructor({
    app = null,
    name = '',
  }) {
    this.name = String(name);
    this.app = app;
    // this.sql = SequelizeService({
    //   app,
    //   name,
    // });
    this.solrService = SolrService({
      app,
      name,
      namespace: 'topics',
    });
  }

  async find(params) {
    const solrResult = await this.solrService.solr.findAll({
      q: params.sanitized.sq || '*:*',
      highlight_by: params.sanitized.sq ? 'topic_suggest' : false,
      order_by: params.query.order_by,
      namespace: 'topics',
      limit: params.query.limit,
      skip: params.query.skip,
    }, this.solrService.Model.solrFactory);

    debug('\'find\' total topics:', solrResult.response.numFound);

    return {
      total: solrResult.response.numFound,
      limit: params.query.limit,
      skip: params.query.skip,
      data: solrResult.response.docs.map((d) => {
        if (solrResult.fragments[d.uid].topic_suggest) {
          d.matches = solrResult.fragments[d.uid].topic_suggest;
        }
        const cached = this.solrService.Model.getCached(d.uid);
        d.relatedTopics = cached.relatedTopics;
        d.countItems = cached.countItems;
        return d;
      }),
      info: {
        ...params.originalQuery,
      },
    };
  }

  async get(id, params) {
    return this.solrService.get(id, params);
  }

  async create(data, params) {
    if (Array.isArray(data)) {
      return Promise.all(data.map(current => this.create(current, params)));
    }

    return data;
  }

  async update(id, data, params) {
    return data;
  }

  async patch(id, data, params) {
    return data;
  }

  async remove(id, params) {
    return { id };
  }
}

module.exports = function (options) {
  return new Service(options);
};

module.exports.Service = Service;
