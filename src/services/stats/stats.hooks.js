const debug = require('debug')('impresso/services:stats.hooks')
const assert = require('assert')
const { BadRequest } = require('@feathersjs/errors')
const { protobuf } = require('impresso-jscommons')

const { statsConfiguration } = require('../../data')
const { TimeDomain, SupportedStats, DefaultStats } = require('./common')

const SupportedIndexes = Object.freeze(Object.keys(statsConfiguration.indexes))
const SupportedFacetsByIndex = SupportedIndexes.reduce((acc, index) => {
  const { term, numeric } = statsConfiguration.indexes[index].facets
  acc[index] = Object.keys(term ?? {}).concat(Object.keys(numeric ?? {}))
  return acc
}, {})
const SupportedDomainsByIndex = SupportedIndexes.reduce((acc, index) => {
  const { term } = statsConfiguration.indexes[index].facets
  acc[index] = Object.keys(term).concat(TimeDomain)
  return acc
}, {})

const deserializeFilters = serializedFilters => {
  if (serializedFilters == null) return []
  try {
    return protobuf.searchQuery.deserialize(serializedFilters).filters || []
  } catch (error) {
    throw new BadRequest(`Could not deserialize filters: ${error.message}`)
  }
}

function parseAndValidateQueryParameters(context) {
  const {
    facet = '',
    index = 'search',
    domain = 'time',
    stats: statsString,
    filters: serializedFilters,
    sort,
    groupby,
  } = context.params.query

  const supportedFacets = SupportedFacetsByIndex[index]
  assert.ok(
    supportedFacets.includes(facet),
    new BadRequest(`Unknown facet "${facet}". Must be one of: ${supportedFacets.join(', ')}`)
  )

  const supportedDomains = SupportedDomainsByIndex[index]
  assert.ok(
    supportedDomains.includes(domain),
    new BadRequest(`Unknown domain "${facet}". Must be one of: ${supportedDomains.join(', ')}`)
  )

  const stats = statsString == null ? DefaultStats : statsString.split(',')
  const unknownStats = stats.filter(stat => !SupportedStats.includes(stat))
  assert.strictEqual(
    unknownStats.length,
    0,
    new BadRequest(`Unknown stats: ${unknownStats.join(', ')}. Supported stats: ${SupportedStats.join(', ')}`)
  )

  const filters = deserializeFilters(serializedFilters)
  debug('[hooks.before.find] filters:', filters)

  context.params.request = {
    facet,
    index,
    domain,
    stats,
    filters,
    sort,
    groupby,
  }
}

/** validate index against supportedIndex */
const validateIndex = context => {
  debug('[hooks.before] validateIndex', context.params)
  const { index } = context.params.query
  if (!SupportedIndexes.includes(index)) {
    throw new BadRequest(`Invalid index: ${index}. Must be one of: ${SupportedIndexes}`)
  }
  debug('[hooks.before] validateIndex', '- index:', index)
}

/**
 * Validate stats parameter
 * @param {Object} context
 */
const validateStats = context => {
  debug('[hooks.before] validateStats')
  const { stats } = context.params.query

  if (stats) {
    const unknownStats = stats.split(',').filter(stat => !SupportedStats.includes(stat))
    if (unknownStats.length > 0) {
      throw new BadRequest(`Invalid stats: ${unknownStats.join(', ')}. Must be one of: ${SupportedStats}`)
    }
  } else {
    context.params.query.stats = DefaultStats
  }
  debug('[hooks.before] validateStats', '- stats:', stats)
}

/**
 * Hook to validate groupby parameter after context.params.index validation
 * Make sure that index is validated before this hook is called.
 * @param {Object} context
 */
const validateGroupByAfterIndex = context => {
  debug('[hooks.before] validateIndexAndGroupby', context.params)
  const { index, groupby } = context.params.query

  if (groupby) {
    if (!SupportedFacetsByIndex[index].includes(groupby)) {
      throw new BadRequest(
        `Invalid groupby parameter for index ${index}: ${groupby}. Must be one of: ${SupportedFacetsByIndex[index]}`
      )
    }
    // translate groupby to solr field
    context.params.query.groupby = statsConfiguration.indexes[index].facets.term[groupby].field
  }
  debug('[hooks.before] validateIndexAndGroupby', '- index:', index, '- groupby:', context.params.query.groupby)
}

export default {
  before: {
    get: [
      validateStats,
      validateIndex,
      validateGroupByAfterIndex,
      // validate id (stats field) after we validate the index
      context => {
        const { id } = context
        const { index } = context.params.query
        if (!SupportedFacetsByIndex[index].includes(id)) {
          throw new BadRequest(`Invalid ID for index ${index}: ${id}. Must be one of: ${SupportedFacetsByIndex[index]}`)
        }
      },
      // parse filters
      context => {
        const { filters } = context.params.query
        context.params.query.filters = deserializeFilters(filters)
      },
    ],
    find: [validateIndex, validateGroupByAfterIndex, parseAndValidateQueryParameters],
  },
}
