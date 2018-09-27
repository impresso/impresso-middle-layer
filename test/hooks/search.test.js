const assert = require('assert');
const { reduceFiltersToSolr, filtersToSolrQuery } = require('../../src/hooks/search');

/*
./node_modules/.bin/eslint \
test/hooks/search.test.js --fix &&
mocha test/hooks/search.test.js
*/


describe('test single reducer in search hook', () => {
  it('for language filters', () => {
    const sq = reduceFiltersToSolr([
      {
        context: 'include',
        type: 'language',
        q: ['french', 'english'],
      },
    ], 'meta_language_s');
    assert.equal('(meta_language_s:french OR meta_language_s:english)', sq);
  });
});

describe('test filtersToSolrQuery hook', () => {
  it('with two filters', async () => {
    const context = {
      type: 'before',
      params: {
        sanitized: {
          filters: [
            {
              context: 'include',
              type: 'string',
              fuzzy: false,
              standalone: false,
              q: 'ambassad*',
            },
            {
              context: 'include',
              type: 'newspaper',
              q: ['GDL'],
            }, {
              context: 'include',
              type: 'year',
              q: ['1957', '1958', '1954'],
            }, {
              context: 'include',
              type: 'language',
              q: ['french'],
            },
          ],
        },
      },
    };
    await filtersToSolrQuery()(context);
    assert.equal(context.params.sanitized.sq, 'content_txt_fr:ambassad* AND (meta_journal_s:GDL) AND (meta_year_i:1957 OR meta_year_i:1958 OR meta_year_i:1954) AND (lg_s:french)', 'transform filters to solr query correctly');
    // console.log(context);
  });

  it('with daterange filters', async () => {
    const context = {
      type: 'before',
      params: {
        sanitized: {
          filters: [
            {
              type: 'daterange',
              context: 'exclude',
              daterange: '1952-01-01T00:00:00Z TO 1953-01-01T00:00:00Z',
            },
            {
              type: 'daterange',
              context: 'include',
              daterange: '1950-01-01T00:00:00Z TO 1958-01-01T00:00:00Z',
            },
          ],
        },
      },
    };
    await filtersToSolrQuery()(context);

    assert.equal(
      context.params.sanitized.sq,
      'NOT (meta_date_dt:[1952-01-01T00:00:00Z TO 1953-01-01T00:00:00Z]) AND meta_date_dt:[1950-01-01T00:00:00Z TO 1958-01-01T00:00:00Z]',
    );
  });

  it('with all possible filters', async () => {
    const context = {
      type: 'before',
      params: {
        sanitized: {
          filters: [
            {
              type: 'daterange',
              context: 'exclude',
              daterange: '1952-01-01T00:00:00Z TO 1953-01-01T00:00:00Z',
            },
            {
              type: 'daterange',
              context: 'include',
              daterange: '1950-01-01T00:00:00Z TO 1958-01-01T00:00:00Z',
            },
            {
              context: 'include',
              type: 'string',
              fuzzy: false,
              standalone: false,
              q: 'ambassad*',
            },
            {
              context: 'include',
              type: 'newspaper',
              q: ['GDL'],
            }, {
              context: 'include',
              type: 'year',
              q: ['1957', '1958', '1954'],
            }, {
              context: 'include',
              type: 'language',
              q: ['french', 'german'],
            },
            {
              context: 'include',
              type: 'type',
              q: ['ar'],
            },
          ],
        },
      },
    };
    await filtersToSolrQuery()(context);
    assert.equal(
      context.params.sanitized.sq,
      'NOT (meta_date_dt:[1952-01-01T00:00:00Z TO 1953-01-01T00:00:00Z]) AND meta_date_dt:[1950-01-01T00:00:00Z TO 1958-01-01T00:00:00Z] AND content_txt_fr:ambassad* AND (meta_journal_s:GDL) AND (meta_year_i:1957 OR meta_year_i:1958 OR meta_year_i:1954) AND (lg_s:french OR lg_s:german) AND (item_type_s:ar)',
    );
  });
});
