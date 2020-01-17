const assert = require('assert');
const {
  unigramTrendsRequestToSolrQuery,
  parseUnigramTrendsResponse,
} = require('../../src/services/ngram-trends/logic/solrQuery');

describe('"ngram-trengs" logic -> unigramTrendsRequestToSolrQuery', () => {
  it('builds expected payload', () => {
    const payload = unigramTrendsRequestToSolrQuery('Einstein', null, ['country']);
    const expectedPayload = {
      query: '*:*',
      limit: 0,
      params: {
        vars: {},
        facet: true,
        'facet.pivot': [
          '{!stats=tf_stats_en key=en}meta_year_i',
          '{!stats=tf_stats_fr key=fr}meta_year_i',
          '{!stats=tf_stats_de key=de}meta_year_i',
        ],
        'stats.field': [
          "{!tag=tf_stats_en key=tf_stats_en sum=true func}termfreq(content_txt_en,'Einstein')",
          "{!tag=tf_stats_fr key=tf_stats_fr sum=true func}termfreq(content_txt_fr,'Einstein')",
          "{!tag=tf_stats_de key=tf_stats_de sum=true func}termfreq(content_txt_de,'Einstein')",
        ],
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
    };

    assert.deepEqual(payload, expectedPayload);
  });
});

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
          meta_country_code_s: [
            'CH',
            27425743,
            'LU',
            4153942,
          ],
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
    };
    const expectedParsedResponse = {
      trends: [
        {
          ngram: 'Einstein',
          values: [273, 176],
          total: 11746,
        },
      ],
      domainValues: ['1969', '1970'],
      info: {
        facets: {},
        responseTime: {
          solr: 6345,
        },
      },
    };
    const parsedResponse = await parseUnigramTrendsResponse(testResponse, 'Einstein');

    assert.deepEqual(parsedResponse, expectedParsedResponse);
  });
});
