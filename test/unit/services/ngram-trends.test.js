import assert from 'assert'
import {
  unigramTrendsRequestToSolrQuery,
  parseUnigramTrendsResponse,
  guessTimeIntervalFromFilters,
  unigramTrendsRequestToTotalTokensSolrQuery,
  getNumbersFromTotalTokensResponse,
} from '../../../src/services/ngram-trends/logic/solrQuery'
import { SupportedLanguageCodes } from '../../../src/models/solr'

describe('"ngram-trengs" logic -> unigramTrendsRequestToSolrQuery', () => {
  it('builds expected payload', () => {
    const payload = unigramTrendsRequestToSolrQuery('Einstein', null, ['country'])
    const expectedPayload = {
      query: '*:*',
      filter: [],
      limit: 0,
      params: {
        vars: {},
        facet: true,
        'facet.limit': -1,
        'facet.pivot': SupportedLanguageCodes.map(langCode => `{!stats=tf_stats_${langCode} key=${langCode}}meta_year_i`).concat([
          `{!stats=tf_stats_other key=other}meta_year_i`,
        ]),
        'stats.field': SupportedLanguageCodes.map(langCode => `{!tag=tf_stats_${langCode} key=tf_stats_${langCode} sum=true func}termfreq(content_txt_${langCode},'Einstein')`).concat([
          `{!tag=tf_stats_other key=tf_stats_other sum=true func}termfreq(content_txt,'Einstein')`,
        ]),
        stats: true,
        'json.facet': JSON.stringify({
          country: {
            type: 'terms',
            field: 'meta_country_code_s',
            mincount: 1,
            limit: 10,
            numBuckets: true,
          },
        }),
        hl: false,
      },
    }

    assert.deepEqual(payload, expectedPayload)
  })
})

describe('"ngram-trends" logic -> parseUnigramTrendsResponse', () => {
  it('parses response', async () => {
    const testResponse = {
      responseHeader: {
        status: 0,
        QTime: 6345,
        params: {
          json: '{\n}',
        },
      },
      response: {
        numFound: 31588228,
        start: 0,
        docs: [],
      },
      facet_counts: {
        facet_queries: {},
        facet_fields: {
          meta_country_code_s: ['CH', 27425743, 'LU', 4153942],
        },
        facet_ranges: {},
        facet_intervals: {},
        facet_heatmaps: {},
        facet_pivot: {
          en: [
            {
              field: 'meta_year_i',
              value: 1970,
              count: 364463,
              stats: {
                stats_fields: {
                  tf_stats_en: {
                    sum: 100.0,
                  },
                },
              },
            },
            {
              field: 'meta_year_i',
              value: 1969,
              count: 359990,
              stats: {
                stats_fields: {
                  tf_stats_en: {
                    sum: 200.0,
                  },
                },
              },
            },
          ],
          fr: [
            {
              field: 'meta_year_i',
              value: 1970,
              count: 364463,
              stats: {
                stats_fields: {
                  tf_stats_fr: {
                    sum: 76.0,
                  },
                },
              },
            },
            {
              field: 'meta_year_i',
              value: 1969,
              count: 359990,
              stats: {
                stats_fields: {
                  tf_stats_fr: {
                    sum: 73.0,
                  },
                },
              },
            },
          ],
        },
      },
      stats: {
        stats_fields: {
          tf_stats_en: {
            sum: 0.0,
          },
          tf_stats_fr: {
            sum: 11746.0,
          },
        },
      },
    }
    const expectedParsedResponse = {
      trends: [
        {
          ngram: 'Einstein',
          values: [273, 176],
          total: 449,
        },
      ],
      domainValues: ['1969', '1970'],
      timeInterval: 'year',
    }
    const parsedResponse = await parseUnigramTrendsResponse(testResponse, 'Einstein', 'year')

    assert.deepEqual(parsedResponse, expectedParsedResponse)
  })
})

describe('"ngram-trends" logic -> guessTimeIntervalFromFilters', () => {
  it('guesses "month" from a time filter range less than 5 years', async () => {
    const filters = [
      {
        type: 'daterange',
        q: ['1849-09-25T00:00:00Z TO 1852-12-31T23:59:59Z'],
        op: 'OR',
      },
    ]
    const timeInterval = guessTimeIntervalFromFilters(filters)

    assert.equal(timeInterval, 'month')
  })
  it('guesses "day" from a time filter range less than 1 year', async () => {
    const filters = [
      {
        type: 'daterange',
        q: ['1849-09-25T00:00:00Z TO 1849-12-31T23:59:59Z'],
        op: 'OR',
      },
    ]
    const timeInterval = guessTimeIntervalFromFilters(filters)

    assert.equal(timeInterval, 'day')
  })
  it('guesses "year" from a time filter range more than 5 years', async () => {
    const filters = [
      {
        type: 'daterange',
        q: ['1849-09-25T00:00:00Z TO 1949-12-31T23:59:59Z'],
        op: 'OR',
      },
    ]
    const timeInterval = guessTimeIntervalFromFilters(filters)

    assert.equal(timeInterval, 'year')
  })
  it('guesses "year" from a time filter with exclude context', async () => {
    const filters = [
      {
        type: 'daterange',
        q: ['1849-09-25T00:00:00Z TO 1849-12-31T23:59:59Z'],
        op: 'OR',
        context: 'exclude',
      },
    ]
    const timeInterval = guessTimeIntervalFromFilters(filters)

    assert.equal(timeInterval, 'year')
  })
  it('guesses "year" from a filters without a daterange filter', async () => {
    const filters = []
    const timeInterval = guessTimeIntervalFromFilters(filters)

    assert.equal(timeInterval, 'year')
  })
})

describe('unigramTrendsRequestToTotalTokensSolrQuery', () => {
  it('builds expected payload', () => {
    const filters = [
      {
        type: 'daterange',
        q: ['1849-09-25T00:00:00Z TO 1949-12-31T23:59:59Z'],
        op: 'OR',
      },
    ]
    const payload = unigramTrendsRequestToTotalTokensSolrQuery(filters, 'year')
    const expectedPayload = {
      query: '*:*',
      filter: ["meta_date_dt:[1849-09-25T00:00:00Z TO 1949-12-31T23:59:59Z]"],
      limit: 0,
      params: {
        vars: {},
        hl: false,
      },
      facet: {
        year: {
          type: 'terms',
          field: 'meta_year_i',
          limit: -1,
          facet: {
            ttc: 'sum(content_length_i)',
          },
        },
      },
    }

    assert.deepEqual(payload, expectedPayload)
  })
})

describe('getNumbersFromTotalTokensResponse', () => {
  const response = {
    responseHeader: {
      status: 0,
      QTime: 1883,
      params: {
        json: '{\n  "query": "filter(content_length_i:[2 TO *]) AND filter(meta_date_dt:[1899-06-25T00:00:00Z TO 1930-08-31T23:59:59Z])",\n  "limit": 0,\n  "params": {\n    "vars": {},\n    "hl": false\n  },\n  "facet": {\n    \t"year": {\n\t    \t"type": "terms",\n\t    \t"field": "meta_year_i",\n\t    \t"facet": {\n\t    \t\t"total_tokens_count": "sum(content_length_i)"\n\t    \t}\n    \t}\n    }\n}',
      },
    },
    response: { numFound: 6064606, start: 0, docs: [] },
    facets: {
      count: 6064606,
      year: {
        buckets: [
          {
            val: 1922,
            count: 223143,
            ttc: 8.0994937e7,
          },
          {
            val: 1913,
            count: 219872,
            ttc: 9.0162505e7,
          },
          {
            val: 1921,
            count: 217282,
            ttc: 8.012569e7,
          },
        ],
      },
    },
  }

  const expectedNumbers = [
    { domain: '1913', value: 9.0162505e7 },
    { domain: '1921', value: 8.012569e7 },
    { domain: '1922', value: 8.0994937e7 },
  ]

  it('parses response', () => {
    const numbers = getNumbersFromTotalTokensResponse(response, 'year')
    assert.deepEqual(numbers, expectedNumbers)
  })
})
