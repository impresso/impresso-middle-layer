import { BadRequest } from '@feathersjs/errors'
import { SolrMappings } from '../../data/constants'

/**
 * @typedef {import('./').Response} Response
 * @typedef {import('./').Request} Request
 * @typedef {import('./').FacetRequest} FacetRequest
 * @typedef {import('impresso-jscommons').Filter} Filter
 * @typedef {import('impresso-jscommons').Facet} Facet
 */

import { getFacetsFromSolrResponse } from '../search/search.extractors'
import { filtersToQueryAndVariables } from '../../util/solr'
import { SolrNamespaces } from '../../solr'
import { logic } from 'impresso-jscommons'

const {
  filter: { mergeFilters },
} = logic

/**
 * Create SOLR query for getting facets.
 * There are two types of facet sections in the query: simple and constrained.
 *
 * Simple type is a standard "term" facet for a field which returns N top items.
 *
 * Constrained type is created when for a certain field we need to retrieve counts
 * of certain variables provided in buckets of a facet of particular type in `constraintFacets`.
 * An example of a constrained facet section could be a "person" facet where we want to retrieve
 * counts of documents that mention persons with IDs "A", "B" and "C". To achieve this we create
 * a separate facet entry for every person ID. Such entry has a type "query" and a filter ("q")
 * matching particular ID.
 *
 * See unit tests for examples.
 *
 * @param {Filter[]} filters
 * @param {FacetRequest[]} facetsRequests
 * @param {Facet[]} constraintFacets
 * @returns {any}
 */
function createSolrQuery(filters, facetsRequests, constraintFacets = []) {
  const { query } = filtersToQueryAndVariables(filters)

  const facets = facetsRequests.reduce((acc, { type, offset, limit }) => {
    const facet = SolrMappings.search.facets[type]
    if (facet == null) throw new BadRequest(`Unknown facet type: "${type}"`)

    // 1. See if there is a constraint for this particular facet type.
    const constraintFacet = constraintFacets.find(({ type: facetType }) => facetType === type)

    // 2. If there is a constraint.
    if (constraintFacet != null) {
      // Go through every bucket in the constraint
      return constraintFacet.buckets.reduce((facetAcc, { val }, index) => {
        // Create a Solr query for this bucket's value.
        const { query: constraintQuery } = filtersToQueryAndVariables([{ type, q: val }])
        // Create a constrained entry in the query.
        return {
          ...facetAcc,
          [`constrained__${type}__${index}`]: {
            type: 'query',
            q: constraintQuery,
          },
        }
      }, acc)
    }

    // 3. Otherwise create a standard facet entry.
    return {
      ...acc,
      [type]: {
        ...facet,
        offset: offset == null ? facet.offset : offset,
        limit: limit == null ? facet.limit : limit,
      },
    }
  }, {})

  return {
    query,
    limit: 0,
    params: { hl: false },
    facet: facets,
  }
}

const ConstrainedFacetRegex = /^constrained__(.+)__(\d+)$/
/**
 * This method normalises SOLR response to a request created with `createSolrQuery`.
 * There we constrained certain term facets and in this function we normalise these
 * facets to the standard term facet form that can be understood by facet parsing code.
 *
 * See unit tests for examples.
 *
 * @param {object} solrResponse
 * @param {Facet[]} constraintFacets
 *
 * @returns {object}
 */
function normaliseFacetsInSolrResponse(solrResponse = {}, constraintFacets = []) {
  const { facets: responseFacets } = solrResponse
  const normalisedFacets = Object.keys(responseFacets).reduce((acc, key) => {
    if (typeof responseFacets[key] !== 'object') return { ...acc, [key]: responseFacets[key] }

    const constrainedFacetMatch = key.match(ConstrainedFacetRegex)
    if (constrainedFacetMatch == null) return { ...acc, [key]: responseFacets[key] }

    const [, constrainedFacetType, constrainedIndexString] = constrainedFacetMatch
    const constrainedIndex = parseInt(constrainedIndexString, 10)

    const constraintFacet = constraintFacets.find(({ type }) => type === constrainedFacetType)
    if (constraintFacet == null) {
      throw new Error(`Found constrained facet "${constrainedFacetType}" in response but no facet provided for it`)
    }

    const facet = acc[constrainedFacetType] == null ? { numBuckets: 0, buckets: [] } : acc[constrainedFacetType]

    facet.numBuckets += 1
    facet.buckets = facet.buckets.concat([
      {
        count: responseFacets[key].count,
        val: constraintFacet.buckets[constrainedIndex].val,
      },
    ])

    acc[constrainedFacetType] = facet

    return acc
  }, {})

  return {
    ...solrResponse,
    facets: normalisedFacets,
  }
}

/**
 * @param {any} solrResponse
 * @returns {Promise<Facet[]>}
 */
async function getResponseFacetsFromSolrResponse(solrResponse, app) {
  const facets = await getFacetsFromSolrResponse(solrResponse, app)
  return Object.keys(facets)
    .filter(type => typeof facets[type] === 'object')
    .map(type => ({
      ...facets[type],
      type,
    }))
}

export class SearchQueriesComparison {
  setup(app) {
    /** @type {import('../../internalServices/simpleSolr').SimpleSolrClient} */
    this.solr = app.service('simpleSolrClient')

    this.app = app

    // this.handlers = {
    //   intersection: this.findIntersectingItemsBetweenQueries.bind(this),
    // };
  }

  /**
   * @param {Request} request
   *
   * @returns {Promise<Response>}
   */
  async create(request) {
    const intersectionFilters = request.filtersSets.reduce((mergedFilters, filters) =>
      mergeFilters(mergedFilters.concat(filters))
    )

    const intersectionSolrQuery = createSolrQuery(intersectionFilters, request.facets)
    const intersectionFacets = await this.solr
      .select(SolrNamespaces.Search, { body: intersectionSolrQuery })
      .then(r => getResponseFacetsFromSolrResponse(r, this.app))

    const otherQueries = request.filtersSets.map(filtersSet =>
      createSolrQuery(filtersSet, request.facets, intersectionFacets)
    )

    const otherQueriesFacets = await Promise.all(
      otherQueries.map(query =>
        this.solr
          .select(SolrNamespaces.Search, { body: query })
          .then(response => normaliseFacetsInSolrResponse(response, intersectionFacets))
          .then(r => getResponseFacetsFromSolrResponse(r, this.app))
      )
    )

    return {
      facetsSets: otherQueriesFacets,
      intersectionFacets,
      facetsIds: request.facets.map(({ type }) => type),
    }
  }
}

export default {
  SearchQueriesComparison,
  createSolrQuery,
  normaliseFacetsInSolrResponse,
}
