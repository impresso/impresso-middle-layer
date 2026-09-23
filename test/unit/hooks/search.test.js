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
      [],
      {}
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
      [],
      {}
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
      [],
      {}
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
    assert.deepEqual(context.params.sanitized.sq, {
      bool: {
        should: [
          'content_txt_fr:ambassad*',
          'content_txt_de:ambassad*',
          'content_txt_en:ambassad*',
          'content_txt_it:ambassad*',
          'content_txt_es:ambassad*',
          'content_txt_nl:ambassad*',
          'content_txt:ambassad*',
        ],
        minimum_should_match: 1,
      },
    })
    assert.deepEqual(context.params.sanitized.sfq, [
      'meta_journal_s:GDL',
      { bool: { should: ['meta_year_i:1957', 'meta_year_i:1958', 'meta_year_i:1954'], minimum_should_match: 1 } },
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

    const fields = ['content_txt_fr', 'content_txt_de', 'content_txt_en', 'content_txt_it', 'content_txt_es', 'content_txt_nl', 'content_txt']
    assert.deepEqual(context.params.sanitized.sq, {
      bool: {
        must: [
          { bool: { should: fields.map(field => `${field}:"accident d'avion"~1`), minimum_should_match: 1 } },
          { bool: { should: fields.map(field => `${field}:(ministre OR portugais)`), minimum_should_match: 1 } },
        ],
      },
    })
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
    assert.deepEqual(context.params.sanitized.sq, {
      bool: {
        should: [
          'content_txt_fr:"ministre portugais"',
          'content_txt_de:"ministre portugais"',
          'content_txt_en:"ministre portugais"',
          'content_txt_it:"ministre portugais"',
          'content_txt_es:"ministre portugais"',
          'content_txt_nl:"ministre portugais"',
          'content_txt:"ministre portugais"',
        ],
        minimum_should_match: 1,
      },
    })
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
    assert.deepEqual(context.params.sanitized.sq, {
      bool: {
        should: [
          'content_txt_fr:"ministre portugais"',
          'content_txt_de:"ministre portugais"',
          'content_txt_en:"ministre portugais"',
          'content_txt_it:"ministre portugais"',
          'content_txt_es:"ministre portugais"',
          'content_txt_nl:"ministre portugais"',
          'content_txt:"ministre portugais"',
        ],
        minimum_should_match: 1,
      },
    })
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
    assert.deepEqual(context.params.sanitized.sq, {
      bool: {
        should: [
          'content_txt_fr:"ministre \\"portugais"',
          'content_txt_de:"ministre \\"portugais"',
          'content_txt_en:"ministre \\"portugais"',
          'content_txt_it:"ministre \\"portugais"',
          'content_txt_es:"ministre \\"portugais"',
          'content_txt_nl:"ministre \\"portugais"',
          'content_txt:"ministre \\"portugais"',
        ],
        minimum_should_match: 1,
      },
    })
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
    const fields = ['content_txt_fr', 'content_txt_de', 'content_txt_en', 'content_txt_it', 'content_txt_es', 'content_txt_nl', 'content_txt']
    assert.deepEqual(context.params.sanitized.sq, {
      bool: {
        should: [
          { bool: { should: fields.map(field => `${field}:"ministre portugais"`), minimum_should_match: 1 } },
          { bool: { should: fields.map(field => `${field}:"ministre italien"`), minimum_should_match: 1 } },
        ],
        minimum_should_match: 1,
      },
    })
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
      'meta_date_dt:[1950-01-01T00:00:00Z TO 1958-01-01T23:59:59Z]',
      {
        bool: {
          must: ['*:*'],
          must_not: ['meta_date_dt:[1952-01-01T00:00:00Z TO 1953-01-01T23:59:59Z]'],
        },
      },
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
    assert.deepEqual(context.params.sanitized.sq, {
      bool: {
        should: [
          'content_txt_fr:ambassad*',
          'content_txt_de:ambassad*',
          'content_txt_en:ambassad*',
          'content_txt_it:ambassad*',
          'content_txt_es:ambassad*',
          'content_txt_nl:ambassad*',
          'content_txt:ambassad*',
        ],
        minimum_should_match: 1,
      },
    })
    assert.deepEqual(context.params.sanitized.sfq, [
      {
        bool: {
          should: [
            'meta_date_dt:[1950-01-01T00:00:00Z TO 1958-01-01T23:59:59Z]',
            'meta_date_dt:[1945-01-01T00:00:00Z TO 1946-01-01T23:59:59Z]',
          ],
          minimum_should_match: 1,
        },
      },
      'meta_journal_s:GDL',
      { bool: { should: ['meta_year_i:1957', 'meta_year_i:1958', 'meta_year_i:1954'], minimum_should_match: 1 } },
      { bool: { should: ['lg_s:fr', 'lg_s:de'], minimum_should_match: 1 } },
      'item_type_s:ar',
      {
        bool: {
          must: ['*:*'],
          must_not: ['meta_date_dt:[1952-01-01T00:00:00Z TO 1953-01-01T23:59:59Z]'],
        },
      },
    ])
  })
})
