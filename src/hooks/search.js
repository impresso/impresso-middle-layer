const debug = require('debug')('impresso/hooks:search');
const _ = require('lodash');

/**
 * filtersToSolrQuery transform string filters
 * in `context.params.sanitized.filters` array to a smart SOLR query
 * @param {Array} fields SOLR fields to wrap query.
 */
const filtersToSolrQuery = (fields = ['content_txt_fr']) => async (context) => {
  if (context.type !== 'before') {
    throw new Error('The \'filtersToSolrQuery\' hook should only be used as a \'before\' hook.');
  }
  if (typeof context.params.sanitized !== 'object') {
    throw new Error('The \'filtersToSolrQuery\' hook should be used after a \'validate\' hook.');
  }
  if (!Array.isArray(context.params.sanitized.filters) && !context.params.sanitized.q) {
    throw new Error('The \'filtersToSolrQuery\' hook should be used with a \'filters\' param or \'q\'!', context.params.sanitized);
  }

  const dateranges = (context.params.sanitized.filters || []).filter(d => d.type === 'daterange' && d.daterange);
  const queries = (context.params.sanitized.filters || []).filter(d => d.type === 'string');



  // if there is a q parameter, let's add it to the very beginning of the query as include.
  if (context.params.sanitized.q) {
    queries.unshift({
      context: 'include',
      type: 'string',
      fuzzy: false,
      standalone: false,
      q: context.params.sanitized.q,
    });
  }
  // context.params.sanitized.sq = 'NOT meta_date_dt:[1950-01-01T23:59:59Z TO 1952-12-31T23:59:59Z] AND meta_date_dt:[1950-01-01T23:59:59Z TO 1960-12-31T23:59:59Z]';
  // return;
  if (!queries.length && !dateranges.length) {
    // context.params.sanitized.sq = 'NOT meta_date_dt:[1950-01-01T23:59:59Z TO 1952-12-31T23:59:59Z]';
    debug('\'filtersToSolrQuery\' cannot find any {type:string} filter:', context.params.sanitized);
    return;
  }

  // dateranges query
  const dq = dateranges.reduce((_sq, query) => {
    let _q;
    let neg = '';
    if (query.context === 'exclude') {
      neg = 'NOT ';
    }
    if(Array.isArray(query.daterange)) {
      _q = `(${query.daterange.join('OR')})`;
    } else {
      _q = query.daterange;
    }
    if (_sq === false) {
      return `${neg}${_q}`;
    }
    return `${_sq} AND ${neg}${_q}`;
  }, false);

  // reduce the queries in filters to final SOLR query `sq`
  const sq = queries.reduce((_sq, query) => {
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


    _q = `${fields[0]}:${_q}`;
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
      return _q;
    }

    if (query.context === 'exclude') {
      op = 'AND NOT';
    }
    return `${_sq} ${op} ${_q}`;
  }, false);

  const solrQuery = [dq, sq].filter(d => d.length).join(' AND ');
  debug('\'filtersToSolrQuery\' with \'solr query\':', solrQuery);
  context.params.sanitized.sq = solrQuery;
  context.params.sanitized.toSq = [].concat(dateranges || [], queries || []);
};

module.exports = {
  filtersToSolrQuery,
};
