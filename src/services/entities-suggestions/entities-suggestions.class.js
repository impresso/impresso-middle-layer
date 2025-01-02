const { Op } = require('sequelize')
const SequelizeService = require('../sequelize.service')
const { measureTime } = require('../../util/instruments')
const { SolrNamespaces } = require('../../solr')

/**
 * @typedef {{
 *  uid: string,
 *  type: string,
 *  name: string,
 *  wikidataId?: string,
 *  matches: string[],
 *  countItems: number,
 *  countMentions: number,
 * }} Entity
 * @typedef {{ limit: number, offset: number, total: number }} Pagination
 */

const EntitySolrFields = Object.freeze({
  Suggest: 'entitySuggest',
  AritcleFrequency: 'article_fq_f',
  MentionFrequency: 'mention_fq_f',
  Id: 'id',
  Label: 'l_s',
  Type: 't_s',
})

const SearchField = EntitySolrFields.Suggest

const DefaultLimit = 20

/**
 * Build Solr query `query` value from a list of names.
 * @param {string[]} names
 * @returns {string}
 */
function buildQueryValue(names) {
  return names
    .map(name => {
      const tokens = name.split(' ').map(token => token.trim().replace(/"/g, ''))
      return tokens.map(token => `${SearchField}:${token}~`).join(' AND ')
    })
    .map(part => `(${part})`)
    .join(' OR ')
}

/**
 * Build Solr query from a list of names.
 * @param {string[]} names
 * @param {number} offset
 * @returns {any}
 */
function buildSolrQuery(names, offset = 0, limit = DefaultLimit) {
  const query = buildQueryValue(names)
  return {
    query,
    sort: `${EntitySolrFields.AritcleFrequency} DESC, ${EntitySolrFields.MentionFrequency} DESC`,
    offset,
    limit,
    params: {
      fl: [
        EntitySolrFields.Id,
        EntitySolrFields.Label,
        EntitySolrFields.Type,
        EntitySolrFields.AritcleFrequency,
        EntitySolrFields.MentionFrequency,
      ],
      'hl.fl': EntitySolrFields.Suggest,
      hl: true,
    },
  }
}

/**
 * @param {any} solrDocument
 * @returns {Entity}
 */
function documentToEntity(solrDocument) {
  return {
    uid: solrDocument[EntitySolrFields.Id],
    type: solrDocument[EntitySolrFields.Type].toLowerCase(),
    name: solrDocument[EntitySolrFields.Label],
    countItems: solrDocument[EntitySolrFields.AritcleFrequency],
    countMentions: solrDocument[EntitySolrFields.MentionFrequency],
    matches: [],
  }
}

/**
 * @param {any} response Solr response
 * @returns {Entity[]}
 */
function getResultsFromSolrResponse(response) {
  /** @type {any[]} */
  const docs = response.response.docs || []

  const entitiesWithoutHighlights = docs.map(documentToEntity)
  const highlights = response.highlighting
  return entitiesWithoutHighlights.map(entity => {
    /** @type {string[]} */
    const matches = highlights[entity.uid][EntitySolrFields.Suggest] || []
    return {
      ...entity,
      matches,
    }
  })
}

/**
 * @param {any} response Solr response
 * @returns {Pagination}
 */
function getPaginationFromSolrResponse(response, limit) {
  return {
    limit,
    total: response.response.numFound,
    offset: response.response.start,
  }
}

class EntitiesSuggestions {
  constructor(app) {
    /** @type {import('../../internalServices/simpleSolr').SimpleSolrClient} */
    this.solr = app.service('simpleSolrClient')
    this.sequelizeService = SequelizeService({
      app,
      name: 'entities',
      cacheReads: true,
    })
  }

  /**
   * @param {Entity[]} entities
   * @returns {Promise<Entity[]>}
   */
  async enrichResultsWithWikidataId(entities) {
    if (entities.length === 0) return entities

    const whereClause = {
      id: {
        [Op.in]: entities.map(({ uid }) => uid),
      },
    }

    const sequelizeResult = await measureTime(
      () =>
        this.sequelizeService.find({
          findAllOnly: true,
          query: {
            limit: entities.length,
            offset: 0,
          },
          where: whereClause,
        }),
      'entities-suggestions.find.db.entities'
    )
    const dbItemsById = sequelizeResult.data.reduce(
      (acc, item) => ({
        ...acc,
        [item.uid]: item,
      }),
      {}
    )
    return entities.map(entity => {
      const dbItem = dbItemsById[entity.uid]
      const wikidataId = dbItem ? dbItem.wikidataId : undefined
      return wikidataId != null ? { ...entity, wikidataId } : entity
    })
  }

  /**
   * Suggest similar entities.
   * NOTE: using `create` because of potentially big payloads.
   * @typedef {{ names: string[], offset?: number, limit?: number }} Payload
   * @param {Payload} payload
   */
  async create({ names, offset = 0, limit = DefaultLimit }) {
    const solrQuery = buildSolrQuery(names, offset, limit)
    const solrResponse = await measureTime(
      () => this.solr.select(SolrNamespaces.Entities, { body: solrQuery }),
      'entities-suggestions.solr.find'
    )
    const solrResults = getResultsFromSolrResponse(solrResponse)
    const pagination = getPaginationFromSolrResponse(solrResponse, limit)
    const results = await this.enrichResultsWithWikidataId(solrResults)

    return {
      results,
      pagination,
    }
  }
}

module.exports = {
  EntitiesSuggestions,
}
