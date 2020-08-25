// @ts-check
const {
  uniq, values, groupBy, get,
} = require('lodash');
const { QueryTypes } = require('sequelize');
const { SolrNamespaces } = require('../../solr');
const { sameTypeFiltersToQuery } = require('../../util/solr');
const { getCacheKeyForReadSqlRequest } = require('../sequelize.service');
const { measureTime } = require('../../util/instruments');
const wikidata = require('../wikidata');

const QueryGetEntityTypeMap = `SELECT id, name
  FROM meta_entities
  WHERE prefix="meta_named entity"`;

/**
 * @typedef {import('../../models').Filter} Filter
 */

const Fields = Object.freeze({
  EntityId: 'e_id_s',
  WikidataId: 'wkd_id_s',
  Name: 'm_name_text',
  TypeCode: 'm_type_s',
  Function: 'm_function_s',
});

function filtersToSolrQuery(filters) {
  const filtersGroupsByType = values(groupBy(filters, 'type'));
  return uniq(filtersGroupsByType
    .map(f => sameTypeFiltersToQuery(f, SolrNamespaces.EntitiesMentions)))
    .join(' AND ');
}

/**
 * @param {Filter[]} filters
 * @param {number} limit
 * @param {number} skip
 */
function buildSolrQuery(filters, limit = 10, skip = 0) {
  return {
    query: filters.length > 0 ? filtersToSolrQuery(filters) : '*:*',
    params: {
      group: true,
      'group.field': Fields.EntityId,
      'group.format': 'simple',
      rows: limit,
      start: skip,
    },
  };
}

const escapeId = id => id.replace(/:/g, '\\:');

function buildGetByIdSolrQuery(id) {
  return { query: `${Fields.EntityId}:${escapeId(id)}` };
}

function documentToEntityOrMention(doc, entityTypeMapping) {
  return {
    type: doc[Fields.WikidataId] == null ? 'mention' : 'entity',
    id: doc[Fields.EntityId],
    label: doc[Fields.Name],
    entityType: entityTypeMapping[doc[Fields.TypeCode]],
    wikidataId: doc[Fields.WikidataId],
    entityFunction: doc[Fields.Function],
  };
}

function parseSolrResponse(response, entityTypeMapping) {
  const total = get(response, `grouped.${Fields.EntityId}.matches`, 0);
  const docs = get(response, `grouped.${Fields.EntityId}.doclist.docs`, []);
  return {
    total,
    items: docs.map(doc => documentToEntityOrMention(doc, entityTypeMapping)),
  };
}

function parseSingleItemSolrResponse(response, entityTypeMapping) {
  const docs = get(response, 'response.docs', []);
  return docs.map(doc => documentToEntityOrMention(doc, entityTypeMapping))[0]
}

class EntitiesMentions {
  constructor(app) {
    /** @type {import('../../cachedSolr').CachedSolrClient} */
    this.solr = app.get('cachedSolr');
    /** @type {import('sequelize').Sequelize} */
    this.sequelize = app.get('sequelizeClient');
    /** @type {import('cache-manager').Cache} */
    this.cacheManager = app.get('cacheManager');
    this.redisClient = app.get('redisClient');
  }

  /**
   * @returns {Promise<{[key: string]: string}>}
   */
  async getEntityTypeByCodeMapping() {
    const cacheKey = getCacheKeyForReadSqlRequest(QueryGetEntityTypeMap);
    const result = await measureTime(() => this.cacheManager.wrap(
      cacheKey,
      () => this.sequelize.query(QueryGetEntityTypeMap, { type: QueryTypes.SELECT }),
    ), 'entities-mentions.find.db.entities_types');

    return Object.freeze(result.reduce((acc, row) => {
      acc[row.id] = row.name;
      return acc;
    }, {}));
  }

  /**
   * @param {string[]} wikidataIds
   * @returns {Promise<{[key: string]: any}>}
   */
  async getWikidataEntries(wikidataIds) {
    if (wikidataIds.length === 0) return {};
    return measureTime(
      () => wikidata.resolve({ ids: wikidataIds, cache: this.redisClient }),
      'entities-mentions.find.wikidata.resolve',
    );
  }

  async enrichEntitiesWithThumbnails(items) {
    const wikidataIds = items
      .map(({ wikidataId }) => wikidataId)
      .filter(item => item != null);

    const wikidataMapping = await this.getWikidataEntries(wikidataIds);

    return items.map((item) => {
      const wikidataEntry = wikidataMapping[item.wikidataId];
      if (wikidataEntry == null
        || wikidataEntry.images == null
        || wikidataEntry.images.length === 0) return item;
      return { ...item, thumbnailUrl: wikidataEntry.images[0].value };
    });
  }

  /**
   * Find mentions and entities
   * @param {{ filters: Filter[], limit?: number, skip?: number }} body
   */
  async create({ filters, limit = 10, skip = 0 }) {
    const entityTypeMapping = await this.getEntityTypeByCodeMapping();

    const query = buildSolrQuery(filters, limit, skip);
    const solrResponse = await this.solr.post(query, this.solr.namespaces.EntitiesMentions);
    const response = parseSolrResponse(solrResponse, entityTypeMapping);
    response.items = await this.enrichEntitiesWithThumbnails(response.items);

    response.skip = skip;
    response.limit = limit;

    return response;
  }

  async get(id) {
    const entityTypeMapping = await this.getEntityTypeByCodeMapping();
    const query = buildGetByIdSolrQuery(id);
    const solrResponse = await this.solr.post(query, this.solr.namespaces.EntitiesMentions);
    const item = parseSingleItemSolrResponse(solrResponse, entityTypeMapping);
    return item;
  }
}

module.exports = { EntitiesMentions, buildSolrQuery };
