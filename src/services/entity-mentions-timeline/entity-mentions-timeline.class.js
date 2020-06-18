// @ts-check
const { uniq, values, groupBy, get } = require('lodash');
const { SolrNamespaces } = require('../../solr');
const { sameTypeFiltersToQuery } = require('../../util/solr');

/**
 * @typedef {import('../../models').Filter} Filter
 */

function filtersToSolrQuery(filters) {
  const filtersGroupsByType = values(groupBy(filters, 'type'));
  return uniq(filtersGroupsByType
    .map(f => sameTypeFiltersToQuery(f, SolrNamespaces.Entities)))
    .join(' AND ');
}

const Resolution = Object.freeze({
  Year: 'year',
  Month: 'month',
});

const Fields = Object.freeze({
  Year: 'meta_year_i',
  Month: 'meta_yearmonth_s',
  PersonEntities: 'pers_entities_dpfs',
  LocationEntities: 'loc_entities_dpfs',
});

const ResolutionToTermField = Object.freeze({
  [Resolution.Year]: Fields.Year,
  [Resolution.Month]: Fields.Month,
});

const ResolutionToLimit = Object.freeze({
  [Resolution.Year]: 400,
  [Resolution.Month]: 10 * 12,
});

const TypeToEntityField = Object.freeze({
  person: Fields.PersonEntities,
  location: Fields.LocationEntities,
});


function buildSolrQueryForEntity(entityId, entityType, filters, resolution) {
  const facet = {
    entity: {
      type: 'terms',
      field: ResolutionToTermField[resolution || Resolution.Year],
      mincount: 1,
      numBuckets: true,
      limit: ResolutionToLimit[resolution || Resolution.Year],
      domain: {
        filter: [TypeToEntityField[entityType], entityId].join(':'),
      },
    },
  };

  return {
    query: filters.length > 0 ? filtersToSolrQuery(filters) : '*:*',
    limit: 0,
    params: {
      hl: false,
    },
    facet,
  };
}

function buildEntityResponse(entity, facetSearchResult) {
  const thumbnailUrl = get(entity, 'wikidata.images.0.value');
  return {
    type: 'entity',
    id: entity.uid,
    label: entity.name,
    wikidataId: entity.wikidataId,
    thumbnailUrl,
    mentionFrequencies: facetSearchResult.facets.entity.buckets,
  };
}

class EntityMentionsTimeline {
  constructor(app) {
    this.app = app;
    /** @type {import('../../cachedSolr').CachedSolrClient} */
    this.solr = app.get('cachedSolr');
    /** @type {import('../entities/entities.class').Service} */
    this.entitiesService = app.service('entities');
    this.app = app;
  }

  async create(body) {
    const { entityId, filters = [] } = body;

    if (entityId) {
      const entity = await this.entitiesService.get(entityId, {});

      const query = buildSolrQueryForEntity(body.entityId, entity.type, filters);
      const result = await this.solr.post(query, this.solr.namespaces.Search);
      return {
        item: buildEntityResponse(entity, result),
      };
    }
    return {};
  }
}

module.exports = {
  EntityMentionsTimeline,
};
