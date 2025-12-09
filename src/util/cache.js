import { intersection } from 'lodash';

/*
  Not everything can be cached in Impresso. Solr and database results
  of queries that contain reference to user collections and results that
  may contain collections should not be cached because they may change
  and Impresso at the moment does not have a way to invalidate particular
  cached items when collections change.

  This file contains utility functions that help decide whether something can
  be cached or not.
 */

const NotCacheableFilterTypes = [
  'collection',
];

const NotCacheableFacetTypes = [
  'collection',
];

/* Assuming we are talking about the main Solr articles index */
const NotCacheableSolrFields = [
  // 'ucoll_ss', // collections ids
];

/**
 * Return `true` if a query with this set of filters can be cached.
 * @param {import('../models').Filter[]} filters
 * @returns {boolean}
 */
function isCacheableQuery(filters) {
  const filtersTypes = [...new Set(filters.map(({ type }) => type))];
  return intersection(filtersTypes, NotCacheableFilterTypes).length === 0;
}

/**
 * Return `true` if this set of facet types can be cached.
 * @param {string[]} facetTypes
 * @returns {boolean}
 */
function areCacheableFacets(facetTypes) {
  return intersection(facetTypes, NotCacheableFacetTypes).length === 0;
}

/**
 * Return `true` if this set of Solr fields can be cached.
 * @param {string[]} solrFields
 * @returns {boolean}
 */
function areCacheableSolrFields(solrFields) {
  return intersection(solrFields, NotCacheableSolrFields).length === 0;
}

export {
  isCacheableQuery,
  areCacheableFacets,
  areCacheableSolrFields,
};
