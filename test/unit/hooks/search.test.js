import assert from 'assert'
import { filtersToSolr } from '@/util/solr/filterReducers'
import { filtersToSolrQuery, queries } from '@/hooks/search'
import { SolrNamespaces } from '@/solr'

/*
./node_modules/.bin/eslint \
src/hooks/search.js test/hooks/search.test.js --config .eslintrc.json --fix &&
NODE_ENV=development mocha test/hooks/search.test.js
*/
describe('test single reducers in search hook', () => {
  it('for language filters', () => {
    const { query: sq } = filtersToSolr(
      [
        {
          context: 'include',
          type: 'language',
          q: ['fr', 'en'],
        },
      ],
      SolrNamespaces.Search,
      []
    )
    assert.deepEqual('(lg_s:fr OR lg_s:en)', sq)
  })

  it('exclude language filters', () => {
    const { query: sq } = filtersToSolr(
      [
        {
          context: 'exclude',
          type: 'language',
          q: ['fr', 'en'],
        },
      ],
      SolrNamespaces.Search,
      []
    )
    // assert.deepEqual('*:* AND NOT ((lg_s:fr OR lg_s:en))', sq);
    assert.deepEqual('NOT (lg_s:fr OR lg_s:en)', sq)
  })

  it('test regex filter, multiple words', () => {
    const { query: sq } = filtersToSolr(
      [
        {
          context: 'include',
          type: 'regex',
          q: '/go[uû]t.*parfait.*/',
        },
      ],
      SolrNamespaces.Search,
      []
    )
    assert.deepEqual(
      sq,
      '(content_txt_fr:/go[uû]t/ OR content_txt_de:/go[uû]t/ OR content_txt_en:/go[uû]t/ OR content_txt_it:/go[uû]t/ OR content_txt_es:/go[uû]t/ OR content_txt_nl:/go[uû]t/ OR content_txt:/go[uû]t/) AND (content_txt_fr:/parfait/ OR content_txt_de:/parfait/ OR content_txt_en:/parfait/ OR content_txt_it:/parfait/ OR content_txt_es:/parfait/ OR content_txt_nl:/parfait/ OR content_txt:/parfait/)'
    )
  })
})

describe('test filtersToSolrQuery hook', () => {
  const mockApp = {
    get() {
      return [{ namespaceId: 'collection_items', serverId: 'cloud-dev', index: 'collections_items' }]
    },
  }
  it('with two filters', async () => {
    const context = {
      app: mockApp,
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
            },
            {
              context: 'include',
              type: 'year',
              q: ['1957', '1958', '1954'],
            },
            {
              context: 'include',
              type: 'language',
              q: ['fr'],
            },
          ],
        },
      },
    }
    await filtersToSolrQuery()(context)
    // console.log(context.params.sanitized);
    assert.equal(
      context.params.sanitized.sq,
      '(content_txt_fr:ambassad* OR content_txt_de:ambassad* OR content_txt_en:ambassad* OR content_txt_it:ambassad* OR content_txt_es:ambassad* OR content_txt_nl:ambassad* OR content_txt:ambassad*)'
    )
    assert.deepEqual(context.params.sanitized.sfq, [
      'meta_journal_s:GDL',
      '(meta_year_i:1957 OR meta_year_i:1958 OR meta_year_i:1954)',
      'lg_s:fr',
    ])
    // console.log(context);
  })

  it('with precision', async () => {
    const context = {
      type: 'before',
      app: mockApp,
      params: {
        sanitized: {
          filters: [
            {
              type: 'string',
              precision: 'fuzzy',
              context: 'include',
              q: "accident d'avion",
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
    }
    await filtersToSolrQuery()(context)

    assert.deepEqual(
      context.params.sanitized.sq,
      '(content_txt_fr:"accident d\'avion"~1 OR content_txt_de:"accident d\'avion"~1 OR content_txt_en:"accident d\'avion"~1 OR content_txt_it:"accident d\'avion"~1 OR content_txt_es:"accident d\'avion"~1 OR content_txt_nl:"accident d\'avion"~1 OR content_txt:"accident d\'avion"~1) AND (content_txt_fr:(ministre OR portugais) OR content_txt_de:(ministre OR portugais) OR content_txt_en:(ministre OR portugais) OR content_txt_it:(ministre OR portugais) OR content_txt_es:(ministre OR portugais) OR content_txt_nl:(ministre OR portugais) OR content_txt:(ministre OR portugais))'
    )
  })

  it('with text context', async () => {
    const context = {
      type: 'before',
      app: mockApp,
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
    }

    await filtersToSolrQuery()(context)
    assert.deepEqual(
      context.params.sanitized.sq,
      `(content_txt_fr:\"ministre portugais\" OR content_txt_de:\"ministre portugais\" OR content_txt_en:\"ministre portugais\" OR content_txt_it:\"ministre portugais\" OR content_txt_es:\"ministre portugais\" OR content_txt_nl:\"ministre portugais\" OR content_txt:\"ministre portugais\")`
    )
    assert.deepEqual(context.params.sanitized.sfq, [queries.hasTextContents, 'front_b:1'])
  })

  it('with text context exact by quotes', async () => {
    const context = {
      type: 'before',
      app: mockApp,
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
              context: 'include',
              q: '"ministre portugais"',
            },
          ],
        },
      },
    }

    await filtersToSolrQuery()(context)
    assert.deepEqual(
      context.params.sanitized.sq,
      `(content_txt_fr:\"ministre portugais\" OR content_txt_de:\"ministre portugais\" OR content_txt_en:\"ministre portugais\" OR content_txt_it:\"ministre portugais\" OR content_txt_es:\"ministre portugais\" OR content_txt_nl:\"ministre portugais\" OR content_txt:\"ministre portugais\")`
    )
    assert.deepEqual(context.params.sanitized.sfq, [queries.hasTextContents, 'front_b:1'])
  })

  it('with text context, escaped wrong quotes', async () => {
    const context = {
      type: 'before',
      app: mockApp,
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
              context: 'include',
              q: '"ministre "portugais"',
            },
          ],
        },
      },
    }

    await filtersToSolrQuery()(context)
    assert.deepEqual(
      context.params.sanitized.sq,
      `(content_txt_fr:\"ministre \\\"portugais\" OR content_txt_de:\"ministre \\\"portugais\" OR content_txt_en:\"ministre \\\"portugais\" OR content_txt_it:\"ministre \\\"portugais\" OR content_txt_es:\"ministre \\\"portugais\" OR content_txt_nl:\"ministre \\\"portugais\" OR content_txt:\"ministre \\\"portugais\")`
    )
    assert.deepEqual(context.params.sanitized.sfq, [queries.hasTextContents, 'front_b:1'])
  })

  it('with text context, with multiple contents', async () => {
    const context = {
      type: 'before',
      app: mockApp,
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
              context: 'include',
              q: ['"ministre portugais"', '"ministre italien"'],
            },
          ],
        },
      },
    }

    await filtersToSolrQuery()(context)
    assert.deepEqual(
      context.params.sanitized.sq,
      `(content_txt_fr:\"ministre portugais\" OR content_txt_de:\"ministre portugais\" OR content_txt_en:\"ministre portugais\" OR content_txt_it:\"ministre portugais\" OR content_txt_es:\"ministre portugais\" OR content_txt_nl:\"ministre portugais\" OR content_txt:\"ministre portugais\") OR (content_txt_fr:\"ministre italien\" OR content_txt_de:\"ministre italien\" OR content_txt_en:\"ministre italien\" OR content_txt_it:\"ministre italien\" OR content_txt_es:\"ministre italien\" OR content_txt_nl:\"ministre italien\" OR content_txt:\"ministre italien\")`
    )
    assert.deepEqual(context.params.sanitized.sfq, [queries.hasTextContents, 'front_b:1'])
  })

  it('with daterange filters', async () => {
    const context = {
      type: 'before',
      app: mockApp,
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
    }
    await filtersToSolrQuery()(context)

    assert.equal(context.params.sanitized.sq, '*:*')
    assert.deepEqual(context.params.sanitized.sfq, [
      '*:* AND NOT (meta_date_dt:[1952-01-01T00:00:00Z TO 1953-01-01T23:59:59Z]) AND meta_date_dt:[1950-01-01T00:00:00Z TO 1958-01-01T23:59:59Z]',
    ])
  })

  it('with all possible filters', async () => {
    const context = {
      type: 'before',
      app: mockApp,
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
              q: ['1950-01-01T00:00:00Z TO 1958-01-01T00:00:00Z', '1945-01-01T00:00:00Z TO 1946-01-01T00:00:00Z'],
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
            },
            {
              context: 'include',
              type: 'year',
              q: ['1957', '1958', '1954'],
            },
            {
              context: 'include',
              type: 'language',
              q: ['fr', 'de'],
            },
            {
              context: 'include',
              type: 'type',
              q: ['ar'],
            },
          ],
        },
      },
    }
    await filtersToSolrQuery()(context)
    assert.equal(
      context.params.sanitized.sq,
      '(content_txt_fr:ambassad* OR content_txt_de:ambassad* OR content_txt_en:ambassad* OR content_txt_it:ambassad* OR content_txt_es:ambassad* OR content_txt_nl:ambassad* OR content_txt:ambassad*)'
    )
    assert.deepEqual(context.params.sanitized.sfq, [
      '*:* AND NOT (meta_date_dt:[1952-01-01T00:00:00Z TO 1953-01-01T23:59:59Z])' +
        ' AND (meta_date_dt:[1950-01-01T00:00:00Z TO 1958-01-01T23:59:59Z] OR meta_date_dt:[1945-01-01T00:00:00Z TO 1946-01-01T23:59:59Z])',
      'meta_journal_s:GDL',
      '(meta_year_i:1957 OR meta_year_i:1958 OR meta_year_i:1954)',
      '(lg_s:fr OR lg_s:de)',
      'item_type_s:ar',
    ])
  })
})
