const assert = require('assert');
const { constants } = require('impresso-jscommons');
const { DataIndex } = require('./index');

const facetRanges = new DataIndex({ name: 'facetRanges' });

function getRangeFacetValue(index, facet, key, defaultValue) {
  const indexData = facetRanges.getValue(index) || {};
  const { [facet]: descriptor = {} } = indexData;
  return descriptor[key] == null
    ? defaultValue
    : descriptor[key];
}

function getRangeFacetParametersWithDefault(index, facet, numBuckets, defaultParameters) {
  const start = getRangeFacetValue(index, facet, 'min', defaultParameters.min);
  const end = getRangeFacetValue(index, facet, 'max', defaultParameters.max);
  const gap = Number.isFinite(start) && Number.isFinite(end)
    ? Math.round((end - start) / numBuckets)
    : defaultParameters.gap;
  return { start, end, gap };
}

/**
 * Various SOLR mappings per index.
 */
const SolrMappings = Object.freeze({
  search: {
    facets: {
      year: {
        type: 'terms',
        field: 'meta_year_i',
        mincount: 1,
        limit: 400, // 400 years
        numBuckets: true,
      },
      contentLength: {
        type: 'range',
        field: 'content_length_i',
        end: 10000,
        start: 0,
        gap: 100,
        other: 'after',
      },
      month: {
        type: 'terms',
        field: 'meta_month_i',
        mincount: 1,
        limit: 120, // ten years granularity
      },
      country: {
        type: 'terms',
        field: 'meta_country_code_s',
        mincount: 1,
        limit: 10,
        numBuckets: true,
      },
      type: {
        type: 'terms',
        field: 'item_type_s',
        mincount: 1,
        limit: 10,
        numBuckets: true,
      },
      topic: {
        type: 'terms',
        field: 'topics_dpfs',
        mincount: 1,
        limit: 10,
        offset: 0,
        numBuckets: true,
      },
      collection: {
        type: 'terms',
        field: 'ucoll_ss',
        mincount: 1,
        limit: 10,
        numBuckets: true,
      },
      newspaper: {
        type: 'terms',
        field: 'meta_journal_s',
        mincount: 1,
        limit: 20,
        numBuckets: true,
      },
      /* Not yet in use. Will be related to "daterange" filter */
      // date: {
      //   type: 'terms',
      //   field: 'meta_date_dt',
      //   mincount: 1,
      //   limit: 100,
      // },
      language: {
        type: 'terms',
        field: 'lg_s',
        mincount: 1,
        numBuckets: true,
      },
      person: {
        type: 'terms',
        field: 'pers_entities_dpfs',
        mincount: 1,
        limit: 10,
        offset: 0,
        numBuckets: true,
      },
      location: {
        type: 'terms',
        field: 'loc_entities_dpfs',
        mincount: 1,
        limit: 10,
        offset: 0,
        numBuckets: true,
      },
      accessRight: {
        type: 'terms',
        field: 'access_right_s',
        mincount: 0,
        limit: 10,
        offset: 0,
        numBuckets: true,
      },
      partner: {
        type: 'terms',
        field: 'meta_partnerid_s',
        mincount: 0,
        limit: 10,
        offset: 0,
        numBuckets: true,
      },
    },
    orderBy: {
      date: 'meta_date_dt',
      relevance: 'score',
      id: 'id',
    },
    groupBy: {
      issues: 'meta_issue_id_s',
      articles: 'id',
      raw: 'id',
    },
  },
  tr_clusters: {
    facets: {
      newspaper: {
        type: 'terms',
        field: 'newspapers_ss',
        mincount: 1,
        limit: 20,
        numBuckets: true,
      },
      textReuseClusterSize: {
        type: 'range',
        field: 'cluster_size_l',
        ...getRangeFacetParametersWithDefault('tr_clusters', 'textReuseClusterSize', 10, {
          end: 100000,
          start: 0,
          gap: 10000,
        }),
      },
      textReuseClusterLexicalOverlap: {
        type: 'range',
        field: 'lex_overlap_d',
        ...getRangeFacetParametersWithDefault('tr_clusters', 'textReuseClusterLexicalOverlap', 10, {
          end: 100,
          start: 0,
          gap: 10,
        }),
      },
      textReuseClusterDayDelta: {
        type: 'range',
        field: 'day_delta_i',
        ...getRangeFacetParametersWithDefault('tr_clusters', 'textReuseClusterDayDelta', 10, {
          end: 100,
          start: 0,
          gap: 10,
        }),
      },
      daterange: {
        type: 'range',
        field: 'max_date_dt',
        ...getRangeFacetParametersWithDefault('tr_clusters', 'daterange', 10, {
          start: '1700-01-01T00:00:00Z',
          end: '2021-01-01T00:00:00Z',
          gap: '+1YEAR',
        }),
      },
    },
  },
  tr_passages: {
    facets: {
      newspaper: {
        type: 'terms',
        field: 'meta_journal_s',
        mincount: 1,
        limit: 20,
        numBuckets: true,
      },
      type: {
        type: 'terms',
        field: 'item_type_s',
        mincount: 1,
        limit: 10,
        numBuckets: true,
      },
    },
  },
});

/* Check that facets are a subset of filter types */
Object
  .keys(SolrMappings.search.facets)
  .forEach(type => assert(constants.filter.Types.includes(type), `Unknown filter type found in facets: ${type}`));

module.exports = {
  SolrMappings,
  FilterTypes: constants.filter.Types,
  Contexts: constants.filter.Contexts,
  Operators: constants.filter.Operators,
  Precision: constants.filter.Precision,
};
