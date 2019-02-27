const assert = require('assert');
const { reduceFiltersToSolr, filtersToSolrQuery } = require('../../src/hooks/search');

/*
./node_modules/.bin/eslint \
src/hooks/search.js test/hooks/search.test.js --config .eslintrc.json --fix &&
mocha test/hooks/search.test.js
*/


describe('test single reducer in search hook', () => {
  it('for language filters', () => {
    const sq = reduceFiltersToSolr([
      {
        context: 'include',
        type: 'language',
        q: ['fr', 'en'],
      },
    ], 'meta_language_s');
    assert.equal('(meta_language_s:fr OR meta_language_s:en)', sq);
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
    assert.equal(context.params.sanitized.sfq, '(meta_journal_s:GDL) AND (meta_year_i:1957 OR meta_year_i:1958 OR meta_year_i:1954) AND (lg_s:french)');
    assert.equal(context.params.sanitized.sq, '(content_txt_en:ambassad* OR content_txt_fr:ambassad* OR content_txt_de:ambassad*)', 'transform filters to solr query correctly');
    // console.log(context);
  });

  it('with precision', async () => {
    const context = {
      type: 'before',
      params: {
        sanitized: {
          filters: [
            {
              type: 'string',
              precision: 'fuzzy',
              context: 'include',
              q: 'accident d\'avion',
            },
            {
              type: 'string',
              precision: 'soft',
              context: 'include',
              q: 'ministre portugais',
            },
          ],
        },
      },
    };
    await filtersToSolrQuery()(context);

    assert.deepEqual(context.params.sanitized.sq, '(content_txt_en:"accident d\'avion"~1 OR content_txt_fr:"accident d\'avion"~1 OR content_txt_de:"accident d\'avion"~1) AND (content_txt_en:(ministre portugais) OR content_txt_fr:(ministre portugais) OR content_txt_de:(ministre portugais))');
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
      context.params.sanitized.sfq,
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
    assert.equal(context.params.sanitized.sq, '(content_txt_en:ambassad* OR content_txt_fr:ambassad* OR content_txt_de:ambassad*)');
    assert.equal(
      context.params.sanitized.sfq,
      'NOT (meta_date_dt:[1952-01-01T00:00:00Z TO 1953-01-01T00:00:00Z]) AND meta_date_dt:[1950-01-01T00:00:00Z TO 1958-01-01T00:00:00Z] AND (meta_journal_s:GDL) AND (meta_year_i:1957 OR meta_year_i:1958 OR meta_year_i:1954) AND (lg_s:french OR lg_s:german) AND (item_type_s:ar)',
    );
  });
});
