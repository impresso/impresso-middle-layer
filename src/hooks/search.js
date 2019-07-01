const debug = require('debug')('impresso/hooks:search');
const lodash = require('lodash');

const SOLR_FILTER_TYPES = [
  'hasTextContents',
  'isFront',
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
 * Translate DPF filter to appropriate field names
 * @type {Object}
 */
const SOLR_FILTER_DPF = {
  topic: 'topics_dpfs',
};


const reduceFiltersToSolr = (filters, field) => filters.reduce((sq, filter) => {
  let qq = '';
  const op = filter.op || 'OR';

  if (Array.isArray(filter.q)) {
    qq = filter.q.map(value => `${field}:${value}`).join(` ${op} `);
  } else {
    qq = `${field}:${filter.q}`;
  }
  if (filter.context === 'exclude') {
    qq = sq.length > 0 ? `NOT ${qq}` : `*:* AND NOT ${qq}`;
  }
  sq.push(qq);
  return sq;
}, []).join(' AND ');

const reduceFiltersToVars = filters => filters.reduce((sq, filter) => {
  if (Array.isArray(filter.q)) {
    filter.q.forEach((q) => {
      sq.push(q);
    });
  } else {
    sq.push(filter.q);
  }
  return sq;
}, []);

const reduceDaterangeFiltersToSolr = filters => filters
  .reduce((sq, filter) => {
    let q;
    if (Array.isArray(filter.q)) {
      q = `${filter.q.map(d => `meta_date_dt:[${d}]`).join(' OR ')}`;
    } else {
      q = `meta_date_dt:[${filter.q}]`;
    }
    if (filter.context === 'exclude') {
      q = sq.length > 0 ? `NOT ${q}` : `*:* AND NOT ${q}`;
    }
    sq.push(q);
    return sq;
  }, []).join(' AND ');

const reduceNumericRangeFilters = (filters, field) => filters
  .reduce((sq, filter) => {
    let q; // q is in the form array ['1 TO 10', '20 TO 30'] (OR condition) or simple string '1 TO X';
    if (Array.isArray(filter.q)) {
      q = `${filter.q.map(d => `${field}:[${d}]`).join(' OR ')}`;
    } else {
      q = `${field}:[${filter.q}]`;
    }
    if (filter.context === 'exclude') {
      q = sq.length > 0 ? `NOT ${q}` : `*:* AND NOT ${q}`;
    }
    sq.push(q);
    return sq;
  }, []).join(' AND ');

const reduceRegexFiltersToSolr = filters => filters.reduce((reduced, query) => {
  // cut regexp at any . not preceded by an escape sign.
  const q = query.q
  // get rid of first / and last /
    .replace(/^\/|\/$/g, '')
  // split on point or spaces
    .split(/\\?\.[*+]/)
  // filterout empty stuff
    .filter(d => d.length)
  // rebuild;
    .map(d => `content_txt_fr:/${d}/`);
  return reduced.concat(q);
}, []).join(' AND ');


const reduceStringFiltersToSolr = (filters, field, languages = ['en', 'fr', 'de']) =>
  // reduce the string in filters to final SOLR query `sq`
  filters.reduce((sq, filter) => {
    let q = filter.q.trim();

    // const isExact = /^"[^"]+"$/.test(q);
    const hasMultipleWords = q.split(' ').length > 1;

    if (filter.precision === 'soft') {
      q = `(${q.split(/\s+/g).join(' ')})`;
    } else if (filter.precision === 'fuzzy') {
      // "richard chase"~1
      q = `"${q.split(/\s+/g).join(' ')}"~1`;
    } else if (hasMultipleWords) {
      // text:"Richard Chase"
      q = q.replace(/"/g, ' ');
      q = `"${q.split(/\s+/g).join(' ')}"`;
    }

    // q multiplied for languages :(
    if (languages.length) {
      const ql = languages.map(lang => `${field}_${lang}:${q}`);

      if (ql.length > 1) {
        q = `(${ql.join(' OR ')})`;
      } else {
        q = ql[0];
      }
    } else {
      q = `${field}:${q}`;
    }

    if (filter.context === 'exclude') {
      q = sq.length > 0 ? `NOT ${q}` : `*:* AND NOT ${q}`;
    }
    sq.push(q);
    return sq;
  }, []).join(' AND ');


const filtersToSolr = (type, filters) => {
  switch (type) {
    case 'hasTextContents':
      return 'content_length_i:[1 TO *]';
    case 'ocrQuality':
      return reduceNumericRangeFilters(filters, 'ocrqa_f');
    case 'contentLength':
      return reduceNumericRangeFilters(filters, 'content_length_i');
    case 'isFront':
      return 'front_b:1';
    case 'string':
      return reduceStringFiltersToSolr(filters, 'content_txt');
    case 'title':
      return reduceStringFiltersToSolr(filters, 'title_txt');
    case 'daterange':
      return reduceDaterangeFiltersToSolr(filters);
    case 'uid':
      return reduceFiltersToSolr(filters, 'id');
    case 'language':
      return reduceFiltersToSolr(filters, 'lg_s');
    case 'page':
      return reduceFiltersToSolr(filters, 'page_id_ss');
    case 'collection':
      return reduceFiltersToSolr(filters, 'ucoll_ss');
    case 'issue':
      return reduceFiltersToSolr(filters, 'meta_issue_id_s');
    case 'newspaper':
      return reduceFiltersToSolr(filters, 'meta_journal_s');
    case 'topic':
      return reduceFiltersToSolr(filters, 'topics_dpfs');
    case 'year':
      return reduceFiltersToSolr(filters, 'meta_year_i');
    case 'type':
      return reduceFiltersToSolr(filters, 'item_type_s');
    case 'mention':
      return reduceFiltersToSolr(filters, ['pers_mentions', 'loc_mentions']);
    case 'person':
      return reduceFiltersToSolr(filters, 'pers_mentions');
    case 'location':
      return reduceFiltersToSolr(filters, 'loc_mentions');
    case 'topicmodel':
      return reduceFiltersToSolr(filters, 'tp_model_s');
    case 'topic-string':
      return reduceStringFiltersToSolr(filters, 'topic_suggest', []);
    case 'regex':
      return reduceRegexFiltersToSolr(filters);
    default:
      throw new Error(`reduceFilterToSolr: filter function for '${type}' not found`);
  }
};

/**
 * Transform q param in a nice string filter.
/**
 * @param  {String} type filter type, gets transkated to actual solr fields.
 * @return {null}      [description]
 */
const qToSolrFilter = (type = 'string') => (context) => {
  if (context.type !== 'before') {
    throw new Error('The \'filtersToSolrQuery\' hook should only be used as a \'before\' hook.');
  }
  if (typeof context.params.sanitized !== 'object') {
    throw new Error('The \'filtersToSolrQuery\' hook should be used after a \'validate\' hook.');
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
const filtersToSolrQuery = () => async (context) => {
  if (context.type !== 'before') {
    throw new Error('The \'filtersToSolrQuery\' hook should only be used as a \'before\' hook.');
  }
  if (typeof context.params.sanitized !== 'object') {
    throw new Error('The \'filtersToSolrQuery\' hook should be used after a \'validate\' hook.');
  }
  if (!Array.isArray(context.params.sanitized.filters)) {
    context.params.sanitized.filters = [];
  }
  if (!context.params.sanitized.filters.length && !context.params.sanitized.q) {
    // nothing is give, wildcard then.
    debug('\'filtersToSolrQuery\' with \'solr query\':', '*:*');
    context.params.sanitized.sq = '*:*';
    context.params.sanitized.queryComponents = [];
    return;
  }

  const filters = lodash.groupBy(context.params.sanitized.filters, 'type');
  const queries = [];
  // const filterQueries = [];
  // will contain payload vars, if any.
  const vars = {};


  Object.keys(filters).forEach((key) => {
    if (['uid', 'string'].indexOf(key) !== -1) {
      queries.push(filtersToSolr(key, filters[key]));
    } else {
      queries.push(`filter(${filtersToSolr(key, filters[key])})`);
    }
    debug('\'filtersToSolrQuery\' key:', key, filters[key]);
    if (SOLR_FILTER_DPF[key]) {
      // add payload variable
      // payload(topics_dpf,tmGDL_tp04_fr)
      reduceFiltersToVars(filters[key]).forEach((d) => {
        const l = Object.keys(vars).length;
        const field = SOLR_FILTER_DPF[key];
        vars[`v${l}`] = `payload(${field},${d})`;
      });
    }
  });

  if (Object.keys(vars).length) {
    if (context.params.sanitized.order_by) {
      context.params.sanitized.order_by = Object.keys(vars)
        .map(d => `${vars[d]} desc`)
        .concat(context.params.sanitized.order_by.split(','))
        .join(',');
    }
  }

  debug('\'filtersToSolrQuery\' vars =', vars, context.params.sanitized);

  // context.params.query.order_by.push()

  context.params.sanitized.sq = queries.length ? queries.join(' AND ') : '*:*';
  // context.params.sanitized.sfq = filterQueries.join(' AND ');
  context.params.sanitized.sv = vars;
  context.params.sanitized.queryComponents = [].concat(
    filters.isFront,
    filters.years,
    filters.newspaper,
    filters.topic,
    filters.collection,
    filters.language,
    filters.daterange,
    filters.type,
    filters.string,
    filters.issue,
    filters.page,
  ).filter(d => typeof d !== 'undefined');
  debug('\'filtersToSolrQuery\' with \'solr query\':', context.params.sanitized.sq);
};

/**
 * check if there are any params to be added to our beloved facets. should follow facets validation
 * @return {[type]}        [description]
 */
const filtersToSolrFacetQuery = () => async (context) => {
  if (!context.params.sanitized.facets) {
    debug('\'filtersToSolrFacetQuery\' warning, no facets requested.');
    return;
  }
  if (typeof context.params.sanitized !== 'object') {
    throw new Error('The \'filtersToSolrQuery\' hook should be used after a \'validate\' hook.');
  }
  const facets = JSON.parse(context.params.sanitized.facets);
  debug('\'filtersToSolrFacetQuery\' on facets:', facets);

  if (!Array.isArray(context.params.sanitized.facetfilters)) {
    context.params.sanitized.facetfilters = [];
  }
  // apply facets recursively based on facet name
  Object.keys(facets).forEach((key) => {
    const filter = context.params.sanitized.facetfilters.find(d => d.name === key);
    if (filter) {
      debug(`filtersToSolrFacetQuery' on facet ${key}:`, filter);
    }
  });
};

module.exports = {
  filtersToSolrQuery,
  qToSolrFilter,
  reduceFiltersToSolr,
  reduceRegexFiltersToSolr,
  filtersToSolrFacetQuery,

  SOLR_FILTER_TYPES,
  SOLR_FILTER_DPF,

  SOLR_ORDER_BY: {
    date: 'meta_date_dt',
    relevance: 'score',
  },

  SOLR_GROUP_BY: {
    issues: 'meta_issue_id_s',
    articles: 'id',
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
    },
    month: {
      type: 'terms',
      field: 'meta_yearmonth_s',
      mincount: 1,
      limit: 120, // ten years granularity
    },
    country: {
      type: 'terms',
      field: 'meta_country_code_s',
      mincount: 1,
      limit: 10,
    },
    type: {
      type: 'terms',
      field: 'item_type_s',
      mincount: 1,
      limit: 10,
    },
    topic: {
      type: 'terms',
      field: 'topics_dpfs',
      mincount: 1,
      limit: 20,
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
    },
  },
};
