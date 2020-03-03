const assert = require('assert');
const { constants } = require('impresso-jscommons');

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
      size: {
        type: 'range',
        field: 'content_length_i',
        end: 10000,
        start: 0,
        gap: 100,
        other: 'after',
      },
      month: {
        type: 'terms',
        field: 'meta_month_s',
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
      date: {
        type: 'terms',
        field: 'meta_date_dt',
        mincount: 1,
        limit: 100,
      },
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
