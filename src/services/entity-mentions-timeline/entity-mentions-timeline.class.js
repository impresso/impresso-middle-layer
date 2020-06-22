// @ts-check
const {
  uniq, values, groupBy, get,
} = require('lodash');
const { SolrNamespaces } = require('../../solr');
const { sameTypeFiltersToQuery } = require('../../util/solr');

/**
 * @typedef {import('../../models').Filter} Filter
 */

function filtersToSolrQuery(filters) {
  const filtersGroupsByType = values(groupBy(filters, 'type'));
  return uniq(filtersGroupsByType
    .map(f => sameTypeFiltersToQuery(f, SolrNamespaces.Search)))
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
  PersonMentions: 'pers_mentions',
  LocationMentions: 'loc_mentions',
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

const TypeToMentionField = Object.freeze({
  person: Fields.PersonMentions,
  location: Fields.LocationMentions,
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


function buildSolrQueryForMention(mentionLabel, mentionType, filters, resolution) {
  const mentionFilter = TypeToMentionField[mentionType] == null
    ? [
      [Fields.PersonMentions, mentionLabel].join(':'),
      [Fields.LocationMentions, mentionLabel].join(':'),
    ].join(' OR ')
    : [TypeToMentionField[mentionType], mentionLabel].join(':');

  const facet = {
    entity: {
      type: 'terms',
      field: ResolutionToTermField[resolution || Resolution.Year],
      mincount: 1,
      numBuckets: true,
      limit: ResolutionToLimit[resolution || Resolution.Year],
      domain: {
        filter: mentionFilter,
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
    entityType: entity.type,
    wikidataId: entity.wikidataId,
    thumbnailUrl,
    mentionFrequencies: facetSearchResult.facets.entity.buckets,
  };
}

function buildMentionResponse(mentionLabel, mentionType, facetSearchResult) {
  return {
    type: 'mention',
    label: mentionLabel,
    entityType: mentionType,
    mentionFrequencies: facetSearchResult.facets.entity.buckets,
  };
}

function getMockSubitems(entity, result, skip = 0, limit = 4) {
  return [...Array(limit).keys()].map(i => ({
    type: 'mention',
    label: `${entity.name} (mock mention ${skip + i})`,
    entityType: entity.type,
    mentionFrequencies: result.facets.entity.buckets,
  }));
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
    const {
      entityId, mentionLabel, mentionType, timeResolution, filters = [], limit = 4, skip = 0,
    } = body;

    if (entityId) {
      const entity = await this.entitiesService.get(entityId, {});

      const query = buildSolrQueryForEntity(body.entityId, entity.type, filters, timeResolution);
      const result = await this.solr.post(query, this.solr.namespaces.Search);
      return {
        item: buildEntityResponse(entity, result),
        subitems: getMockSubitems(entity, result, skip, limit),
      };
    }

    const query = buildSolrQueryForMention(mentionLabel, mentionType, filters, timeResolution);
    const result = await this.solr.post(query, this.solr.namespaces.Search);
    return {
      item: buildMentionResponse(mentionLabel, mentionType, result),
    };
  }
}

module.exports = {
  EntityMentionsTimeline,
};
