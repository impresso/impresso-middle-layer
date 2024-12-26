import assert from 'assert'
import { Sequelize } from 'sequelize'
import sinon from 'sinon'
import { MediaSource } from '../../src/models/generated/schemas'
import { SelectResponse, SimpleSolrClient } from '../../src/internalServices/simpleSolr'
import { consolidateMediaSources, DBNewspaperDetails, FacetBucket } from '../../src/useCases/consolidateMediaSources'

type DBResponse = DBNewspaperDetails[]
type SolrResponse = SelectResponse<unknown, 'sources', FacetBucket>

describe('consolidateMediaSources', () => {
  const dbClient: Sequelize = { query: () => null } as unknown as Sequelize
  const solrClient: SimpleSolrClient = { select: () => null } as unknown as SimpleSolrClient

  afterEach(() => {
    sinon.restore()
  })

  it('should consolidate media sources correctly', async () => {
    const dbResponse = [
      {
        uid: 'ZBT',
        name: 'Test Newspaper',
        publishedFromYear: 1900,
        publishedToYear: 2000,
        issueCount: 100,
        pageCount: 1000,
        languageCodes: ['en', 'fr'],
        properties: [{ id: 'test', label: 'test', value: 'test' }],
      },
    ] satisfies DBResponse

    const solrResponse = {
      facets: {
        sources: {
          buckets: [{ val: 'ZBT', count: 500, minDate: '1900-01-01T00:00:00Z', maxDate: '2000-12-31T00:00:00Z' }],
        },
      },
    } satisfies SolrResponse

    sinon.mock(dbClient).expects('query').once().withArgs(sinon.match.any).resolves(dbResponse)
    sinon.mock(solrClient).expects('select').once().withArgs(sinon.match.any).resolves(solrResponse)

    const result = await consolidateMediaSources(dbClient, solrClient, 'test')
    const expected = [
      {
        uid: 'ZBT',
        type: 'newspaper',
        name: 'Test Newspaper',
        languageCodes: ['en', 'fr'],
        publishedPeriodYears: [1900, 2000],
        availableDatesRange: ['1900-01-01T00:00:00.000Z', '2000-12-31T00:00:00.000Z'],
        totals: {
          articles: 500,
          issues: 100,
          pages: 1000,
        },
        properties: [{ id: 'test', label: 'test', value: 'test' }],
      },
    ] satisfies MediaSource[]

    assert.deepEqual(result, expected)
  })

  it('should handle empty database response', async () => {
    const dbResponse = [] satisfies DBResponse
    const solrResponse = { facets: { sources: { buckets: [] } } } satisfies SolrResponse
    sinon.mock(dbClient).expects('query').once().withArgs(sinon.match.any).resolves(dbResponse)
    sinon.mock(solrClient).expects('select').once().withArgs(sinon.match.any).resolves(solrResponse)

    const result = await consolidateMediaSources(dbClient, solrClient, 'test')

    assert.deepEqual(result, [])
  })

  it('should handle missing articles count in Solr response', async () => {
    const dbResponse = [
      {
        uid: 'ZBT',
        name: 'Test Newspaper',
        publishedFromYear: 1900,
        publishedToYear: 2000,
        issueCount: 100,
        pageCount: 1000,
        languageCodes: ['en', 'fr'],
        properties: [{ id: 'test', label: 'test', value: 'test' }],
      },
    ] satisfies DBResponse
    const solrResponse = { facets: { sources: { buckets: [] } } } satisfies SolrResponse

    sinon.mock(dbClient).expects('query').once().withArgs(sinon.match.any).resolves(dbResponse)
    sinon.mock(solrClient).expects('select').once().withArgs(sinon.match.any).resolves(solrResponse)

    const result = await consolidateMediaSources(dbClient, solrClient, 'test')
    const expected = [
      {
        uid: 'ZBT',
        type: 'newspaper',
        name: 'Test Newspaper',
        languageCodes: ['en', 'fr'],
        publishedPeriodYears: [1900, 2000],
        totals: {
          articles: 0,
          issues: 100,
          pages: 1000,
        },
        properties: [{ id: 'test', label: 'test', value: 'test' }],
      },
    ] satisfies MediaSource[]

    assert.deepEqual(result, expected)
  })
})
