// @ts-check
const debug = require('debug')('impresso/services:stats');
const assert = require('assert');
const { BadRequest } = require('@feathersjs/errors');
const { protobuf } = require('impresso-jscommons');

const { statsConfiguration } = require('../../data');
const { TimeDomain, SupportedStats, DefaultStats } = require('./common');

const SupportedIndexes = Object.freeze(Object.keys(statsConfiguration.indexes));
const SupportedFacetsByIndex = SupportedIndexes.reduce((acc, index) => {
  const { term, numeric } = statsConfiguration.indexes[index].facets;
  acc[index] = Object.keys(term).concat(Object.keys(numeric));
  return acc;
}, {});
const SupportedDomainsByIndex = SupportedIndexes.reduce((acc, index) => {
  const { term } = statsConfiguration.indexes[index].facets;
  acc[index] = Object.keys(term).concat(TimeDomain);
  return acc;
}, {});

const deserializeFilters = (serializedFilters) => {
  if (serializedFilters == null) return [];
  try {
    return protobuf.searchQuery.deserialize(serializedFilters).filters || [];
  } catch (error) {
    throw new BadRequest(`Could not deserialize filters: ${error.message}`);
  }
};

function parseAndValidateQueryParameters (context) {
  const {
    facet = '',
    index = 'search',
    domain = 'time',
    stats: statsString,
    filters: serializedFilters,
    sort
  } = context.params.query;
  assert.ok(SupportedIndexes.includes(index), new BadRequest(`Unknown index "${index}". Must be one of: ${SupportedIndexes.join(', ')}`));

  const supportedFacets = SupportedFacetsByIndex[index];
  assert.ok(supportedFacets.includes(facet), new BadRequest(`Unknown facet "${facet}". Must be one of: ${supportedFacets.join(', ')}`));

  const supportedDomains = SupportedDomainsByIndex[index];
  assert.ok(supportedDomains.includes(domain), new BadRequest(`Unknown domain "${facet}". Must be one of: ${supportedDomains.join(', ')}`));

  const stats = statsString == null ? DefaultStats : statsString.split(',');
  const unknownStats = stats.filter(stat => !SupportedStats.includes(stat));
  assert.equal(unknownStats.length, 0, new BadRequest(`Unknown stats: ${unknownStats.join(', ')}. Supported stats: ${SupportedStats.join(', ')}`));

  const filters = deserializeFilters(serializedFilters);
  debug('parseAndValidateQueryParameters', filters)

  context.params.request = {
    facet,
    index,
    domain,
    stats,
    filters,
    sort
  };
}

module.exports = {
  before: {
    find: [
      parseAndValidateQueryParameters,
    ],
  },
};
