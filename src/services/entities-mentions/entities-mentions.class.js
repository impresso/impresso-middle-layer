// @ts-check
const {
  uniq, values, groupBy, get,
} = require('lodash');
const { SolrNamespaces } = require('../../solr');
const { sameTypeFiltersToQuery } = require('../../util/solr');

/**
 * @typedef {import('../../models').Filter} Filter
 */

const Fields = Object.freeze({
  EntityId: 'e_id_s',
  WikidataId: 'wkd_id_s',
  Name: 'm_name_s',
  TypeCode: 'm_type_s',
});

const TypeCodeToEntityType = Object.freeze({
  50: 'Person',
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
    query: filtersToSolrQuery(filters),
    params: {
      group: true,
      'group.field': Fields.EntityId,
      'group.format': 'simple',
      rows: limit,
      start: skip,
    },
  };
}

function documentToEntitOrMention(doc) {
  return {
    type: doc[Fields.WikidataId] == null ? 'mention' : 'entity',
    id: doc[Fields.EntityId],
    label: doc[Fields.Name],
    entityType: TypeCodeToEntityType[doc[Fields.TypeCode]],
    wikidataId: doc[Fields.WikidataId],
  };
}

function parseSolrResponse(response) {
  const total = get(response, `grouped.${Fields.EntityId}.matches`, 0);
  const docs = get(response, `grouped.${Fields.EntityId}.doclist.docs`, []);
  return {
    total,
    items: docs.map(documentToEntitOrMention),
  };
}

class EntitiesMentions {
  constructor(app) {
    /** @type {import('../../cachedSolr').CachedSolrClient} */
    this.solr = app.get('cachedSolr');
  }

  /**
   * Find mentions and entities
   * @param {{ filters: Filter[], limit?: number, skip?: number }} body
   */
  async create({ filters, limit = 10, skip = 0 }) {
    const query = buildSolrQuery(filters, limit, skip);
    const solrResponse = await this.solr.post(query, this.solr.namespaces.EntitiesMentions);
    const response = parseSolrResponse(solrResponse);

    response.skip = skip;
    response.limit = limit;
    // TODO: enrich with wikidata' thumbnail url

    return response;
  }
}

module.exports = { EntitiesMentions, buildSolrQuery };
