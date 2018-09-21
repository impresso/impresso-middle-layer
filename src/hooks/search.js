const debug = require('debug')('impresso/hooks:search');
const lodash = require('lodash');


const reduceFiltersToSolr = (filters, field) => filters.reduce((sq, filter) => {
  sq.push(filter.q.map(value => `${field}:${value}`).join(' OR '));
  return sq;
}, []).map(d => `(${d})`).join(' AND ');


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


const reduceStringFiltersToSolr = filters =>
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


    _q = `content_txt_fr:${_q}`;
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
  // console.log('filtersToSolr', type, filters.length);
  switch (type) {
    case 'string':
      return reduceStringFiltersToSolr(filters);
    case 'daterange':
      return reduceDaterangeFiltersToSolr(filters);
    case 'language':
      return reduceFiltersToSolr(filters, 'lg_s');
    case 'newspaper':
      return reduceFiltersToSolr(filters, 'meta_journal_s');
    case 'year':
      return reduceFiltersToSolr(filters, 'meta_year_i');
    case 'type':
      return reduceFiltersToSolr(filters, 'item_type_s');
    default:
      throw new Error(`reduceFilterToSolr: filter function for '${type}' not found`);
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

  // if there is a q parameter, let's add it to the very beginning of the query as include.
  if (context.params.sanitized.q) {
    if (!filters.string) {
      filters.string = [];
    }
    filters.string.unshift({
      context: 'include',
      type: 'string',
      fuzzy: false,
      standalone: false,
      q: context.params.sanitized.q,
    });
  }

  Object.keys(filters).forEach((key) => {
    queries.push(filtersToSolr(key, filters[key]));
  });

  const solrQuery = queries.join(' AND ');
  debug('\'filtersToSolrQuery\' with \'solr query\':', solrQuery);
  context.params.sanitized.sq = solrQuery;
  context.params.sanitized.queryComponents = [].concat(
    filters.years,
    filters.newspaper,
    filters.language,
    filters.daterange,
    filters.type,
    filters.string,

  ).filter(d => d && d.length);
};


module.exports = {
  filtersToSolrQuery,
  reduceFiltersToSolr,
};
