const debug = require('debug')('impresso/hooks:search');
const lodash = require('lodash');
const config = require('@feathersjs/configuration')()();

const {
  filtersToQueryAndVariables,
} = require('../util/solr');


const SOLR_FILTER_TYPES = [
  'hasTextContents',
  'title',
  'isFront',
  'title',
  'string', 'entity', 'newspaper', 'daterange',
  'year', 'language', 'type', 'regex',
  // mention allows to find both mentions of type person and location
  'mention', 'person', 'location',
  // today's special
  'topic',
  // filter by user collections! Only when authentified
  'collection',
  // numeric filters
  'ocrQuality',
  'contentLength',
];

/**
 * Transform q param in a nice string filter.
 * @param  {String} type filter type, gets transkated to actual solr fields.
 * @return {null}      [description]
 */
const qToSolrFilter = (type = 'string') => (context) => {
  if (context.type !== 'before') {
    throw new Error('[qToSolrFilter] hook should only be used as a \'before\' hook.');
  }
  if (typeof context.params.sanitized !== 'object') {
    throw new Error('[qToSolrFilter] hook should be used after a \'validate\' hook.');
  }
  if (!Array.isArray(context.params.sanitized.filters)) {
    context.params.sanitized.filters = [];
  }
  if (context.params.sanitized.q) {
    context.params.sanitized.filters.unshift({
      context: 'include',
      type,
      fuzzy: false,
      standalone: false,
      q: context.params.sanitized.q,
    });
  }
};

/**
 * filtersToSolrQuery transform string filters
 * in `context.params.sanitized.filters` array to a smart SOLR query
 *
 */
const filtersToSolrQuery = ({ overrideOrderBy = true, prop = 'params' } = {}) => async (context) => {
  const prefix = `[filtersToSolrQuery (${context.path}.${context.method})]`;
  if (context.type !== 'before') {
    throw new Error(`${prefix} hook should only be used as a 'before' hook.`);
  }
  if (typeof context[prop].sanitized !== 'object') {
    context[prop].sanitized = {};
  }
  if (!Array.isArray(context[prop].sanitized.filters)) {
    context[prop].sanitized.filters = [];
  }
  if (!context[prop].sanitized.filters.length && !context[prop].sanitized.q) {
    // nothing is give, wildcard then.
    debug(`${prefix} with 'solr query': *:*`);
    context[prop].sanitized.sq = '*:*';
    context[prop].sanitized.queryComponents = [];
    return;
  }

  const { query, variables: vars } = filtersToQueryAndVariables(context[prop].sanitized.filters);

  // prepend order by if it is not relevance
  if (overrideOrderBy && config.solr.dataVersion > 1 && Object.keys(vars).length) {
    // relevance direction
    let direction = 'desc';
    if (context[prop].sanitized.order_by && context[prop].sanitized.order_by.indexOf('score asc') > -1) {
      direction = 'asc';
    }
    const varsOrderBy = Object.keys(vars).map(v => `$\{${v}} ${direction}`);
    // if order by is by relevance:
    if (context[prop].sanitized.order_by && context[prop].sanitized.order_by.indexOf('score') === 0) {
      context[prop].sanitized.order_by = varsOrderBy
        .concat(context[prop].sanitized.order_by.split(','))
        .join(',');
    } else if (context[prop].sanitized.order_by) {
      context[prop].sanitized.order_by = context[prop].sanitized.order_by
        .split(',')
        .concat(varsOrderBy)
        .join(',');
    } else {
      context[prop].sanitized.order_by = varsOrderBy.join(',');
    }
  }
  debug(`${prefix} query order_by:`, context[prop].sanitized.order_by);
  debug(`${prefix} vars =`, vars, context[prop].sanitized);

  // context[prop].query.order_by.push()

  context[prop].sanitized.sq = query;
  // context[prop].sanitized.sfq = filterQueries.join(' AND ');
  context[prop].sanitized.sv = vars;
  // NOTE: `queryComponents` should be deprecated
  const filters = lodash.groupBy(context[prop].sanitized.filters, 'type');
  context[prop].sanitized.queryComponents = [].concat(
    filters.isFront,
    filters.years,
    filters.newspaper,
    filters.topic,
    filters.person,
    filters.location,
    filters.collection,
    filters.language,
    filters.daterange,
    filters.type,
    filters.country,
    filters.string,
    filters.title,
    filters.issue,
    filters.page,
  ).filter(d => typeof d !== 'undefined');
  debug(`${prefix} with 'solr query': ${context[prop].sanitized.sq}`);
};

/**
 * check if there are any params to be added to our beloved facets. should follow facets validation
 * @return {[type]}        [description]
 */
const filtersToSolrFacetQuery = () => async (context) => {
  if (!context.params.sanitized.facets) {
    debug('[filtersToSolrFacetQuery] WARN no facets requested.');
    return;
  }
  if (typeof context.params.sanitized !== 'object') {
    throw new Error('[filtersToSolrFacetQuery] hook should be used after a \'validate\' hook.');
  }
  const facets = JSON.parse(context.params.sanitized.facets);
  debug('[filtersToSolrFacetQuery] on facets:', facets);

  if (!Array.isArray(context.params.sanitized.facetfilters)) {
    context.params.sanitized.facetfilters = [];
  }
  // apply facets recursively based on facet name
  Object.keys(facets).forEach((key) => {
    const filter = context.params.sanitized.facetfilters.find(d => d.name === key);
    if (filter) {
      debug(`[filtersToSolrFacetQuery] on facet ${key}:`, filter);
    }
  });
};

module.exports = {
  queries: config.solr.queries,
  filtersToSolrQuery,
  qToSolrFilter,
  filtersToSolrFacetQuery,

  SOLR_FILTER_TYPES,

  SOLR_ORDER_BY: {
    date: 'meta_date_dt',
    relevance: 'score',
    id: 'id',
  },

  SOLR_GROUP_BY: {
    issues: 'meta_issue_id_s',
    articles: 'id',
    raw: 'id',
  },

  SOLR_INVERTED_GROUP_BY: {
    meta_issue_id_s: 'issues',
    id: 'articles',
  },

  SOLR_FACETS: {
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
};
