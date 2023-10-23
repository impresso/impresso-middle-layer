/* eslint-disable no-unused-vars */
const debug = require('debug')('impresso/services:entities');
const lodash = require('lodash');
const { Op } = require('sequelize');
const { NotFound } = require('@feathersjs/errors');

const wikidata = require('../wikidata');

const Entity = require('../../models/entities.model');
const SequelizeService = require('../sequelize.service');
const { measureTime } = require('../../util/instruments');
const { buildSearchEntitiesSolrQuery } = require('./logic');

class Service {
  constructor ({ app }) {
    this.app = app;
    this.name = 'entities';
    this.sequelizeService = new SequelizeService({
      app,
      name: this.name,
    });
    /** @type {import('../../cachedSolr').CachedSolrClient} */
    this.solr = app.get('cachedSolr');
  }

  async create (data, params) {
    params.query = data;
    return this.find(params);
  }

  async find (params) {
    debug('[find] with params:', params.query);

    const query = buildSearchEntitiesSolrQuery({
      filters: params.query.filters,
      orderBy: params.query.order_by,
      limit: params.query.limit,
      skip: params.query.skip,
    });
    debug('[find] solr query:', query);

    const solrResult = await measureTime(() => this.solr.post(
      query,
      this.solr.namespaces.Entities,
    ), 'entities.find.solr.mentions');

    const entities = solrResult.response.docs.map(Entity.solrFactory());

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
    // generate the sequelize clause.
    const where = {
      id: {
        [Op.in]: entities.map(d => d.uid),
      },
    };
    // get sequelize results
    const sequelizeResult = await measureTime(() => this.sequelizeService.find({
      findAllOnly: true,
      query: {
        limit: entities.length,
        skip: 0,
      },
      where,
    }), 'entities.find.db.entities');

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

        // enrich with fragments, if any provided:
        if (solrResult.highlighting[d.uid].entitySuggest) {
          d.matches = solrResult.highlighting[d.uid].entitySuggest;
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
      wkdIds.map(wkdId => measureTime(() => wikidata.resolve({
        ids: [wkdId],
        cache: this.app.get('redisClient'),
      }).then((resolved) => {
        resolvedEntities[wkdId] = resolved[wkdId];
      }), 'entities.find.wikidata.get')),
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

  async get (id, params) {
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

  async update (id, data, params) {
    return data;
  }

  async patch (id, data, params) {
    return data;
  }

  async remove (id, params) {
    return { id };
  }
}

module.exports = function (options) {
  return new Service(options);
};

module.exports.Service = Service;
