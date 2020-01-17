const assert = require('assert');
const {
  reduceFiltersToSolr,
  reduceRegexFiltersToSolr,
} = require('../../src/util/solr/filterReducers');
const { filtersToSolrQuery } = require('../../src/hooks/search');

/*
./node_modules/.bin/eslint \
src/hooks/search.js test/hooks/search.test.js --config .eslintrc.json --fix &&
NODE_ENV=development mocha test/hooks/search.test.js
*/
describe('test single reducers in search hook', () => {
  it('for language filters', () => {
    const sq = reduceFiltersToSolr([
      {
        context: 'include',
        type: 'language',
        q: ['fr', 'en'],
      },
    ], 'lg_s');
    assert.deepEqual('(lg_s:fr OR lg_s:en)', sq);
  });

  it('exclude language filters', () => {
    const sq = reduceFiltersToSolr([
      {
        context: 'exclude',
        type: 'language',
        q: ['fr', 'en'],
      },
    ], 'lg_s');
    assert.deepEqual('*:* AND NOT ((lg_s:fr OR lg_s:en))', sq);
  });

  it('test regex filter, multiple words', () => {
    const sq = reduceRegexFiltersToSolr([{
      context: 'include',
      type: 'regex',
      q: '/go[uû]t.*parfait.*/',
    }]);
    assert.deepEqual('content_txt_fr:/go[uû]t/ AND content_txt_fr:/parfait/', sq);
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
    // console.log(context.params.sanitized);
    assert.equal(context.params.sanitized.sq, '(content_txt_en:ambassad* OR content_txt_fr:ambassad* OR content_txt_de:ambassad*) AND filter((meta_journal_s:GDL)) AND filter((meta_year_i:1957 OR meta_year_i:1958 OR meta_year_i:1954)) AND filter((lg_s:french))');
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

    assert.deepEqual(context.params.sanitized.sq, '(content_txt_en:"accident d\'avion"~1 OR content_txt_fr:"accident d\'avion"~1 OR content_txt_de:"accident d\'avion"~1) AND (content_txt_en:(ministre OR portugais) OR content_txt_fr:(ministre OR portugais) OR content_txt_de:(ministre OR portugais))');
  });

  it('with text context', async () => {
    const context = {
      type: 'before',
      params: {
        sanitized: {
          filters: [
            {
              type: 'hasTextContents',
            },
            {
              type: 'isFront',
            },
            {
              type: 'string',
              precision: 'exact',
              context: 'include',
              q: 'ministre portugais',
            },
          ],
        },
      },
    };

    await filtersToSolrQuery()(context);
    assert.deepEqual(context.params.sanitized.sq, `filter(${queries.hasTextContents}) AND filter(front_b:1) AND (content_txt_en:"ministre portugais" OR content_txt_fr:"ministre portugais" OR content_txt_de:"ministre portugais")`);
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
              q: '1952-01-01T00:00:00Z TO 1953-01-01T00:00:00Z',
            },
            {
              type: 'daterange',
              context: 'include',
              daterange: '1950-01-01T00:00:00Z TO 1958-01-01T00:00:00Z',
              q: '1950-01-01T00:00:00Z TO 1958-01-01T00:00:00Z',
            },
          ],
        },
      },
    };
    await filtersToSolrQuery()(context);

    assert.equal(
      context.params.sanitized.sq,
      'filter(*:* AND NOT (meta_date_dt:[1952-01-01T00:00:00Z TO 1953-01-01T00:00:00Z]) AND meta_date_dt:[1950-01-01T00:00:00Z TO 1958-01-01T00:00:00Z])',
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
              q: '1952-01-01T00:00:00Z TO 1953-01-01T00:00:00Z',
            },
            {
              type: 'daterange',
              context: 'include',
              q: [
                '1950-01-01T00:00:00Z TO 1958-01-01T00:00:00Z',
                '1945-01-01T00:00:00Z TO 1946-01-01T00:00:00Z',
              ],
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
      [
        'filter(*:* AND NOT (meta_date_dt:[1952-01-01T00:00:00Z TO 1953-01-01T00:00:00Z])',
        ' AND (meta_date_dt:[1950-01-01T00:00:00Z TO 1958-01-01T00:00:00Z] OR meta_date_dt:[1945-01-01T00:00:00Z TO 1946-01-01T00:00:00Z]))',
        ' AND (content_txt_en:ambassad* OR content_txt_fr:ambassad* OR content_txt_de:ambassad*)',
        ' AND filter((meta_journal_s:GDL))',
        ' AND filter((meta_year_i:1957 OR meta_year_i:1958 OR meta_year_i:1954))',
        ' AND filter((lg_s:french OR lg_s:german)) AND filter((item_type_s:ar))',
      ].join(''),
    );
  });
});
