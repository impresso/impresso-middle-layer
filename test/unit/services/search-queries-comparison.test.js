import assert from 'assert'
import {
  createSolrQuery,
  normaliseFacetsInSolrResponse,
} from '../../../src/services/search-queries-comparison/search-queries-comparison.class'

/**
 * @typedef {import('impresso-jscommons').Filter} Filter
 * @typedef {import('impresso-jscommons').Facet} Facet
 * @typedef {import('impresso-jscommons').Bucket} Bucket
 * @typedef {import('../../src/services/search-queries-comparison').FacetRequest} FacetRequest
 */

describe('createSolrQuery', () => {
  it('creates a query without constraints', () => {
    const filters = /** @type {Filter[]} */[{ type: 'person', q: 'person-a-id' }]
    const facetRequests = /** @type {FacetRequest[]} */[{ type: 'person', limit: 3, offset: 5 }]
    const expectedRequest = {
      limit: 0,
      params: {
        hl: false,
      },
      query: 'filter(pers_entities_dpfs:person-a-id)',
      filter: [],
      facet: {
        person: {
          field: 'pers_entities_dpfs',
          limit: 3,
          offset: 5,
          type: 'terms',
          mincount: 1,
          numBuckets: true,
        },
      },
    }

    const request = createSolrQuery(filters, facetRequests)
    assert.deepEqual(request, expectedRequest)
  })

  it('creates a query with constraints', () => {
    const filters = /** @type {Filter[]} */[{ type: 'person', q: 'person-a-id' }]
    const facetRequests = /** @type {FacetRequest[]} */[{ type: 'person', limit: 3, offset: 5 }]
    const facetConstraints = /** @type {Facet[]} */[
      {
        type: 'person',
        buckets: [
          {
            val: 'person-b-id',
          },
          {
            val: 'person-c-id',
          },
        ],
      },
    ]

    const expectedRequest = {
      limit: 0,
      params: {
        hl: false,
      },
      query: 'filter(pers_entities_dpfs:person-a-id)',
      filter: [],
      facet: {
        constrained__person__0: {
          type: 'query',
          q: 'filter(pers_entities_dpfs:person-b-id)',
        },
        constrained__person__1: {
          type: 'query',
          q: 'filter(pers_entities_dpfs:person-c-id)',
        },
      },
    }

    const request = createSolrQuery(filters, facetRequests, facetConstraints)
    assert.deepEqual(request, expectedRequest)
  })
})

describe('normaliseFacetsInSolrResponse', () => {
  const testSolrResponse = {
    response: {
      numFound: 2143,
      start: 0,
      docs: [],
    },
    facets: {
      count: 2143,
      constrained__person__0: {
        count: 20,
      },
      constrained__person__1: {
        count: 2143,
      },
      year: {
        numBuckets: 16,
        buckets: [
          {
            val: 1985,
            count: 3,
          },
          {
            val: 1946,
            count: 2,
          },
        ],
      },
    },
  }

  const testConstraintFacets = /** @type {Facet[]} */[
    {
      type: 'person',
      buckets: [
        {
          val: 'person-b-id',
        },
        {
          val: 'person-c-id',
        },
      ],
    },
  ]

  const expectedNormalisedResponse = {
    response: {
      numFound: 2143,
      start: 0,
      docs: [],
    },
    facets: {
      count: 2143,
      person: {
        numBuckets: 2,
        buckets: [
          {
            val: 'person-b-id',
            count: 20,
          },
          {
            val: 'person-c-id',
            count: 2143,
          },
        ],
      },
      year: {
        numBuckets: 16,
        buckets: [
          {
            val: 1985,
            count: 3,
          },
          {
            val: 1946,
            count: 2,
          },
        ],
      },
    },
  }

  it('normalises facets', () => {
    const response = normaliseFacetsInSolrResponse(testSolrResponse, testConstraintFacets)
    assert.deepEqual(response, expectedNormalisedResponse)
  })
})
