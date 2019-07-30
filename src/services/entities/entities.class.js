/* eslint-disable no-unused-vars */
const debug = require('debug')('impresso/services:entities');
const lodash = require('lodash');
const { Op } = require('sequelize');
const wikidata = require('../wikidata');
const Entity = require('../../models/entities.model');
const SequelizeService = require('../sequelize.service');

class Service {
  constructor({
    app = null,
    name = '',
  } = {}) {
    this.app = app;
    this.name = name;
    this.SequelizeService = SequelizeService({
      app,
      name,
    });
    this.solrClient = app.get('solrClient');
  }

  async find(params) {
    debug('\'find\' total entities:', 0, params);

    // get solr results for the queyr, if any; return raw results.
    const solrResult = await this.solrClient.findAll({
      q: params.sanitized.sq || '*:*',
      fl: 'id,l_s,t_s,article_fq_f,mention_fq_f',
      namespace: 'entities',
      limit: params.query.limit,
      skip: params.query.skip,
    }, Entity.solrFactory);
    debug('\'find\' total entities:', solrResult.response.numFound);
    // is Empty?
    if (!solrResult.response.numFound) {
      return {
        total: 0,
        data: [],
        limit: params.query.limit,
        skip: params.query.skip,
      };
    }
    // get list of uid from solr.
    const entities = solrResult.response.docs;
    // generate the sequelize clause.
    const where = {
      id: {
        [Op.in]: entities.map(d => d.uid),
      },
    };
    // get sequelize results
    const sequelizeResult = await this.SequelizeService.find({
      findAllOnly: true,
      query: {
        limit: entities.length,
        skip: 0,
      },
      where,
    });

    // entities from sequelize, containing wikidata and dbpedia urls
    const sequelizeEntitiesIndex = lodash.keyBy(sequelizeResult.data, 'uid');
    const result = {
      total: solrResult.response.numFound,
      limit: params.query.limit,
      skip: params.query.skip,
      data: entities.map((d) => {
        // enrich with wikidataID
        d.wikidataId = sequelizeEntitiesIndex[d.uid].wikidataId;
        return d;
      }),
    };

    if (!params.sanitized.resolve) { // no need to resolve?
      debug('\'find\' completed, SKIP wikidata.');
      return result;
    }

    // get wikidata ids
    const wkdIds = lodash(sequelizeEntitiesIndex)
      .map('wikidataId')
      .compact()
      .value();

    debug('\'find\'loading wikidata:', wkdIds.length);
    const resolvedEntities = {};

    return Promise.all(
      wkdIds.map(wkdId => wikidata.resolve({
        ids: [wkdId],
        cache: this.app.get('redisClient'),
      }).then((resolved) => {
        resolvedEntities[wkdId] = resolved[wkdId];
      })),
    ).then((res) => {
      debug('\'find\'loading wikidata success');
      result.data = result.data.map((d) => {
        if (d.wikidataId) {
          d.wikidata = resolvedEntities[d.wikidataId];
        }
        return d;
      });
      return result;
    }).catch((err) => {
      console.error(err);
      return result;
    });
  }

  async get(id, params) {
    const where = {
      id,
    };

    const entity = await this.SequelizeService.get(id, { where })
      .then(d => d.toJSON());

    if (!entity.wikidataId) {
      return entity;
    }

    return wikidata.resolve({
      ids: [entity.wikidataId],
      cache: this.app.get('redisClient'),
    }).then((res) => {
      if (res[entity.wikidataId]) {
        entity.wikidata = res[entity.wikidataId];
      }
      return entity;
    }).catch((err) => {
      console.log(err);
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
