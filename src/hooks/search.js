const debug = require('debug')('impresso/hooks:search');
const lodash = require('lodash');

const SOLR_FILTER_TYPES = [
  'string', 'entity', 'newspaper', 'daterange',
  'year', 'language', 'type', 'regex',
  // mention allows to find both mentions of type person and location
  'mention', 'person', 'location',
  // today's special
  'topic',
];

const SOLR_FILTER_DPF = [
  'topic',
];

const reduceFiltersToSolr = (filters, field) => filters.reduce((sq, filter) => {
  if (Array.isArray(filter.q)) {
    sq.push(filter.q.map(value => `${field}:${value}`).join(' OR '));
  } else {
    sq.push(`${field}:${filter.q}`);
  }
  return sq;
}, []).map(d => `(${d})`).join(' AND ');

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
    if (Array.isArray(filter.daterange)) {
      q = `(${filter.daterange.join('OR')})`;
    } else {
      q = `meta_date_dt:[${filter.daterange}]`;
    }
    sq.push(filter.context === 'exclude' ? `NOT (${q})` : q);
    return sq;
  }, []).join(' AND ');

const reduceRegexFiltersToSolr = filters =>
  filters.reduce((reduced, query) => {
    // cut regexp at any . not preceded by an escape sign.
    console.log('reduceRegexFiltersToSolr', query);
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


const reduceStringFiltersToSolr = (filters, field) =>
  // reduce the string in filters to final SOLR query `sq`
  filters.reduce((_sq, query) => {
    // const specialchars = '+ - && || ! ( ) { } [ ] ^ " ~ * ? : \\'.split(' ');
    // operator
    let op = 'AND';
    // const field = fields[0];
    // solarized query is the initial query
    let _q = query.q.trim();
    // const _isExact = /^"[^"]+"$/.test(_q);
    const _hasSpaces = _q.split(' ').length > 1;

    if (!query.standalone) {
      // escape special chars

      // if there are spaces, use parenthesis
      if (_hasSpaces) {
        _q = `(${query.q.split(/\s+/g).join(' ')})`;
      }
    }


    _q = `${field}:${_q}`;
    // is standalone SOLR? Surround by parenthesis
    // if(isSolrStandalone(q)) {
    //   return q
    // }
    // if(isSolrExact(q)) {
    //
    // }
    // first loop


    // console.log('prevuois loop:', sq)
    if (_sq === false) {
      if (query.context === 'exclude') {
        return `NOT (${_q})`; // first negation!
      }
      return _q;
    }

    if (query.context === 'exclude') {
      op = 'AND NOT';
    }
    return `${_sq} ${op} ${_q}`;
  }, false);


const filtersToSolr = (type, filters) => {
  // console.log('filtersToSolr', type, filters);
  switch (type) {
    case 'string':
      return reduceStringFiltersToSolr(filters, 'content_txt_fr');
    case 'daterange':
      return reduceDaterangeFiltersToSolr(filters);
    case 'uid':
      return reduceFiltersToSolr(filters, 'id');
    case 'language':
      return reduceFiltersToSolr(filters, 'lg_s');
    case 'page':
      return reduceFiltersToSolr(filters, 'page_id_ss');
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
      return reduceStringFiltersToSolr(filters, 'topic_suggest');
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
  // will contain payload vars, if any.
  const vars = {};

  // if there is a q parameter, let's add it to the very beginning of the query as include.


  Object.keys(filters).forEach((key) => {
    queries.push(filtersToSolr(key, filters[key]));
    debug('\'filtersToSolrQuery\' key:', key, filters[key]);
    if (SOLR_FILTER_DPF.indexOf(key) !== -1) {
      // add payload variable
      // payload(topics_dpf,tmGDL_tp04_fr)
      reduceFiltersToVars(filters[key]).forEach((d) => {
        const l = Object.keys(vars).length;
        vars[`v${l}`] = `payload(${key}_dpfs,${d})`;
      });
    }
  });

  debug('\'filtersToSolrQuery\' vars =', vars);

  context.params.sanitized.sq = queries.join(' AND ');
  context.params.sanitized.sv = vars;
  context.params.sanitized.queryComponents = [].concat(
    filters.years,
    filters.newspaper,
    filters.language,
    filters.daterange,
    filters.type,
    filters.string,
    filters.issue,
    filters.page,
  ).filter(d => typeof d !== 'undefined');
  debug('\'filtersToSolrQuery\' with \'solr query\':', context.params.sanitized.sq);
};


module.exports = {
  filtersToSolrQuery,
  qToSolrFilter,
  reduceFiltersToSolr,


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
      limit: 400,
    },
    topic: {
      type: 'terms',
      field: 'topics_dpfs',
      mincount: 1,
      limit: 20,
      numBuckets: true,
    },
    newspaper: {
      type: 'terms',
      field: 'meta_journal_s',
      mincount: 1,
      maxcount: 750,
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
