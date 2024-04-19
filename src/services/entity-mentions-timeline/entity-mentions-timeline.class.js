const { uniq, values, groupBy, get } = require('lodash')
const { SolrNamespaces } = require('../../solr')
const { sameTypeFiltersToQuery } = require('../../util/solr')

/**
 * @typedef {import('../../models').Filter} Filter
 */

function filtersToSolrQuery(filters) {
  const filtersGroupsByType = values(groupBy(filters, 'type'))
  return uniq(filtersGroupsByType.map(f => sameTypeFiltersToQuery(f, SolrNamespaces.Search))).join(' AND ')
}

const Resolution = Object.freeze({
  Year: 'year',
  Month: 'month',
})

const Fields = Object.freeze({
  Year: 'meta_year_i',
  Month: 'meta_yearmonth_s',
  PersonEntities: 'pers_entities_dpfs',
  LocationEntities: 'loc_entities_dpfs',
  PersonMentions: 'pers_mentions',
  LocationMentions: 'loc_mentions',
})

const EntityMentionFields = Object.freeze({
  MentionLabel: 'surface_s',
  EntityId: 'entity_id_s',
})

const ResolutionToTermField = Object.freeze({
  [Resolution.Year]: Fields.Year,
  [Resolution.Month]: Fields.Month,
})

const ResolutionToLimit = Object.freeze({
  [Resolution.Year]: 400,
  [Resolution.Month]: 10 * 12,
})

const TypeToEntityField = Object.freeze({
  person: Fields.PersonEntities,
  location: Fields.LocationEntities,
})

const TypeToMentionField = Object.freeze({
  person: Fields.PersonMentions,
  location: Fields.LocationMentions,
})

function buildLinkedMentionsSolrQuery(entityId, skip = 0, limit = 4) {
  const facet = {
    mentionLabel: {
      type: 'terms',
      field: EntityMentionFields.MentionLabel,
      numBuckets: true,
      mincount: 1,
      offset: skip,
      limit,
    },
  }

  return {
    query: `${EntityMentionFields.EntityId}:"${entityId}"`,
    limit: 0,
    facet,
  }
}

/**
 * Response parser for `buildLinkedMentionsSolrQuery`.
 * @param {any} response
 * @returns {{ labels: any[], total: number }}
 */
function getMentionLabelsFromSolrResponse(response) {
  if (response.facets.mentionLabel == null) return { labels: [], total: 0 }
  return {
    labels: response.facets.mentionLabel.buckets.map(bucket => bucket.val),
    total: response.facets.mentionLabel.numBuckets,
  }
}

function buildSolrQueryForEntity(entityId, entityType, entityMentionLabels, filters, resolution) {
  const facet = {
    entity: {
      type: 'terms',
      field: ResolutionToTermField[resolution || Resolution.Year],
      mincount: 1,
      numBuckets: true,
      limit: ResolutionToLimit[resolution || Resolution.Year],
      domain: {
        filter: [TypeToEntityField[entityType], `"${entityId}"`].join(':'),
      },
    },
  }

  entityMentionLabels.forEach((label, index) => {
    facet[`mention_${index}`] = {
      type: 'terms',
      field: ResolutionToTermField[resolution || Resolution.Year],
      mincount: 1,
      numBuckets: true,
      limit: ResolutionToLimit[resolution || Resolution.Year],
      domain: {
        // NOTE: we are assuming that all mention labels are of the same type as the entity.
        filter: [TypeToMentionField[entityType], `"${label}"`].join(':'),
      },
    }
  })

  return {
    query: filters.length > 0 ? filtersToSolrQuery(filters) : '*:*',
    limit: 0,
    params: {
      hl: false,
    },
    facet,
  }
}

function buildSolrQueryForMention(mentionLabel, mentionType, filters, resolution) {
  const mentionFilter =
    TypeToMentionField[mentionType] == null
      ? [
          [Fields.PersonMentions, `"${mentionLabel}"`].join(':'),
          [Fields.LocationMentions, `"${mentionLabel}"`].join(':'),
        ].join(' OR ')
      : [TypeToMentionField[mentionType], `"${mentionLabel}"`].join(':')

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
  }

  return {
    query: filters.length > 0 ? filtersToSolrQuery(filters) : '*:*',
    limit: 0,
    params: {
      hl: false,
    },
    facet,
  }
}

function buildEntityResponse(entity, facetSearchResult) {
  const thumbnailUrl = get(entity, 'wikidata.images.0.value')
  return {
    type: 'entity',
    id: entity.uid,
    label: entity.name,
    entityType: entity.type,
    wikidataId: entity.wikidataId,
    thumbnailUrl,
    mentionFrequencies: facetSearchResult.facets.entity.buckets,
  }
}

function buildEntitySubitemsResponse(entity, result, entityMentionLabels) {
  return entityMentionLabels.map((label, index) => ({
    type: 'mention',
    label,
    entityType: entity.type,
    mentionFrequencies: result.facets[`mention_${index}`].buckets,
  }))
}

function buildMentionResponse(mentionLabel, mentionType, facetSearchResult) {
  return {
    type: 'mention',
    label: mentionLabel,
    entityType: mentionType,
    mentionFrequencies: facetSearchResult.facets.entity.buckets,
  }
}

class EntityMentionsTimeline {
  constructor(app) {
    this.app = app
    /** @type {import('../../cachedSolr').CachedSolrClient} */
    this.solr = app.service('cachedSolr')
    /** @type {import('../entities/entities.class').Service} */
    this.entitiesService = app.service('entities')
    this.app = app
  }

  async create(body) {
    const { entityId, mentionLabel, mentionType, timeResolution, filters = [], limit = 4, skip = 0 } = body

    if (entityId) {
      // Get linked entities
      const linkedMentionsQuery = buildLinkedMentionsSolrQuery(body.entityId, skip, limit)
      const linkedMentionsPromise = this.solr
        .post(linkedMentionsQuery, this.solr.namespaces.EntitiesMentions)
        .then(getMentionLabelsFromSolrResponse)
      const entityPromise = this.entitiesService.get(entityId, {})

      const [entity, { labels: entityMentionLabels, total: totalSubitems }] = await Promise.all([
        entityPromise,
        linkedMentionsPromise,
      ])

      const query = buildSolrQueryForEntity(body.entityId, entity.type, entityMentionLabels, filters, timeResolution)

      const result = await this.solr.post(query, this.solr.namespaces.Search)
      return {
        item: buildEntityResponse(entity, result),
        subitems: buildEntitySubitemsResponse(entity, result, entityMentionLabels),
        totalSubitems,
      }
    }

    const query = buildSolrQueryForMention(mentionLabel, mentionType, filters, timeResolution)
    const result = await this.solr.post(query, this.solr.namespaces.Search)
    return {
      item: buildMentionResponse(mentionLabel, mentionType, result),
    }
  }
}

module.exports = {
  EntityMentionsTimeline,
}
