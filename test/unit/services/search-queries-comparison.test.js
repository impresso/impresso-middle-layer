import assert from 'assert'
import {
  createSolrQuery,
  normaliseFacetsInSolrResponse,
} from '@/services/search-queries-comparison/search-queries-comparison.class'

/**
 * @typedef {import('impresso-jscommons').Filter} Filter
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
      query: '*:*',
      filter: ['pers_entities_dpfs:person-a-id'],
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

    const request = createSolrQuery(filters, facetRequests, [], [], {})
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
      query: '*:*',
      filter: ['pers_entities_dpfs:person-a-id'],
      facet: {
        constrained__person__0: {
          type: 'query',
          q: 'pers_entities_dpfs:person-b-id',
        },
        constrained__person__1: {
          type: 'query',
          q: 'pers_entities_dpfs:person-c-id',
        },
      },
    }

    const request = createSolrQuery(filters, facetRequests, facetConstraints, [], {})
    assert.deepEqual(request, expectedRequest)
  })

  it('serialises a constraint that is a range query', () => {
    const filters = /** @type {Filter[]} */[{ type: 'person', q: 'person-a-id' }]
    const facetRequests = /** @type {FacetRequest[]} */[{ type: 'daterange' }]
    const facetConstraints = /** @type {Facet[]} */[
      { type: 'daterange', buckets: [{ val: '1900-01-01 TO 1910-12-31' }] },
    ]

    const request = createSolrQuery(filters, facetRequests, facetConstraints, [], {})
    assert.deepEqual(request.facet, {
      constrained__daterange__0: {
        type: 'query',
        q: 'meta_date_dt:[1900-01-01T00:00:00Z TO 1910-12-31T23:59:59Z]',
      },
    })
  })

  it('serialises a constraint that is a join query', () => {
    const filters = /** @type {Filter[]} */[{ type: 'person', q: 'person-a-id' }]
    const facetRequests = /** @type {FacetRequest[]} */[{ type: 'collection' }]
    const facetConstraints = /** @type {Facet[]} */[{ type: 'collection', buckets: [{ val: 'coll-1' }] }]
    const namespaces = [{ namespaceId: 'collection_items', index: 'collection_items_idx' }]

    const request = createSolrQuery(filters, facetRequests, facetConstraints, namespaces, {})
    assert.deepEqual(request.facet, {
      constrained__collection__0: {
        type: 'query',
        q: '{!join from=ci_id_s to=id fromIndex=collection_items_idx method=crossCollection}col_id_s:*_coll-1',
      },
    })
  })

  it('mixes constrained and standard facet entries', () => {
    const filters = /** @type {Filter[]} */[{ type: 'person', q: 'person-a-id' }]
    const facetRequests = /** @type {FacetRequest[]} */[
      { type: 'person', limit: 3, offset: 5 },
      { type: 'language' },
    ]
    const facetConstraints = /** @type {Facet[]} */[{ type: 'person', buckets: [{ val: 'person-b-id' }] }]

    const request = createSolrQuery(filters, facetRequests, facetConstraints, [], {})
    assert.deepEqual(Object.keys(request.facet), ['constrained__person__0', 'language'])
    assert.equal(request.facet.constrained__person__0.q, 'pers_entities_dpfs:person-b-id')
    assert.equal(request.facet.language.type, 'terms')
  })

  it('does not use the JSON query DSL in constrained facet queries', () => {
    const filters = /** @type {Filter[]} */[{ type: 'person', q: 'person-a-id' }]
    const facetRequests = /** @type {FacetRequest[]} */[{ type: 'newspaper' }]
    const facetConstraints = /** @type {Facet[]} */[
      { type: 'newspaper', buckets: [{ val: 'GDL' }, { val: 'JDG' }] },
    ]

    const request = createSolrQuery(filters, facetRequests, facetConstraints, [], {})
    Object.values(request.facet).forEach(entry => {
      assert.equal(entry.type, 'query')
      assert.equal(typeof entry.q, 'string')
    })
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
