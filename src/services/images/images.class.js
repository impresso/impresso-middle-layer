/* eslint-disable no-unused-vars */
const { NotFound } = require('@feathersjs/errors');
const debug = require('debug')('impresso/services:images');
const SolrService = require('../solr.service');
const Image = require('../../models/images.model');

class Service {
  constructor({
    app = null,
    name = '',
  }) {
    this.app = app;
    this.name = name;
    this.SolrService = SolrService({
      app,
      name,
      namespace: 'images',
    });
  }

  async find(params) {
    debug(`find '${this.name}': with params.isSafe:${params.isSafe} and params.query:`, params.query);
    if (params.query.similarTo) {
      debug('get similarTo vector ...', params.query.similarTo);
      const signature = await this.SolrService.solr.findAll({
        q: `id:${params.query.similarTo}`,
        fl: ['id', `signature:_vector_${params.query.vectorType}_bv`],
        namespace: 'images',
        limit: 1,
      })
        .then(res => res.response.docs[0].signature)
        .catch((err) => {
          throw new NotFound();
        });

      if (!signature) {
        throw new NotFound('signature not found');
      }
      return this.SolrService.solr.findAll({
        fq: params.query.sq,
        form: {
          q: `{!vectorscoring f="_vector_${params.query.vectorType}_bv" vector_b64="${signature}"}`,
        },
        fl: '*,score',
        namespace: 'images',
        limit: params.query.limit,
        skip: params.query.skip,
        facets: params.query.facets,
        order_by: 'score DESC',
      }, Image.solrFactory).then(res => this.SolrService.solr.utils.wrapAll(res));
    }

    return this.SolrService.find({
      ...params,
      fl: Image.SOLR_FL,
    });
  }

  async get(id, params) {
    debug(`get '${this.name}': with params.isSafe:${params.isSafe} and params.query:`, params.query);
    return this.SolrService.get(id, {
      fl: Image.SOLR_FL,
    });
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
