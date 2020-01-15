/* eslint-disable no-unused-vars */
const debug = require('debug')('impresso/services:entities');
const lodash = require('lodash');
const { Op } = require('sequelize');
const { NotFound } = require('@feathersjs/errors');

const wikidata = require('../wikidata');

const Entity = require('../../models/entities.model');
const SequelizeService = require('../sequelize.service');
const SolrService = require('../solr.service');

class Service {
  constructor({ app }) {
    this.app = app;
    this.name = 'entities';
    this.sequelizeService = new SequelizeService({
      app,
      name: this.name,
    });
    this.solrService = new SolrService({
      app,
      name: this.name,
      namespace: this.name,
    });
  }

  async find(params) {
    debug('[find] with params:', params.query);

    // get solr results for the queyr, if any; return raw results.
    const solrResult = await this.solrService.solr.findAll({
      q: params.sanitized.sq || '*:*',
      fl: 'id,l_s,t_s,article_fq_f,mention_fq_f',
      highlight_by: params.sanitized.sq ? 'entitySuggest' : false,
      order_by: params.query.order_by,
      namespace: 'entities',
      limit: params.query.limit,
      skip: params.query.skip,
    }, Entity.solrFactory);

    debug('[find] total entities:', solrResult.response.numFound);
    // is Empty?
    if (!solrResult.response.numFound) {
      return {
        total: 0,
        data: [],
        limit: params.query.limit,
        skip: params.query.skip,
        info: {
          ...params.originalQuery,
        },
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
    const sequelizeResult = await this.sequelizeService.find({
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
        if (sequelizeEntitiesIndex[d.uid]) {
          // enrich with wikidataID
          d.wikidataId = sequelizeEntitiesIndex[d.uid].wikidataId;
        }
        // nerich with fragments, if any provided:
        if (solrResult.fragments[d.uid].entitySuggest) {
          d.matches = solrResult.fragments[d.uid].entitySuggest;
        }
        return d;
      }),
      info: {
        ...params.originalQuery,
      },
    };

    if (!params.sanitized.resolve) { // no need to resolve?
      debug('[find] completed, no param resolve, then SKIP wikidata.');
      return result;
    }

    // get wikidata ids
    const wkdIds = lodash(sequelizeEntitiesIndex)
      .map('wikidataId')
      .compact()
      .value();

    debug('[find] wikidata loading:', wkdIds.length);
    const resolvedEntities = {};

    return Promise.all(
      wkdIds.map(wkdId => wikidata.resolve({
        ids: [wkdId],
        cache: this.app.get('redisClient'),
      }).then((resolved) => {
        resolvedEntities[wkdId] = resolved[wkdId];
      })),
    ).then((res) => {
      debug('[find] wikidata success!');
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
    return this.find({
      ...params,
      query: {
        resolve: true,
        limit: 1,
        filters: [
          {
            type: 'uid',
            // yes, entities id can have " in their name... check entities tests.
            q: `${id.split('"').join('*')}`, // no comment
          },
        ],
      },
    }).then((res) => {
      if (!res.data.length) {
        throw new NotFound();
      }
      return res.data[0];
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
