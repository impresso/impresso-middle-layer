import { strict as assert } from 'assert'
import { buildCollectionJoinFilter } from '@/services/search-facets/search-facets.class.js'
import { InvalidArgumentError } from '@/util/error.js'
import { SolrQueryNode } from '@/util/solr/queryBuilder.js'

describe('buildCollectionJoinFilter', () => {
  it('builds a legacy crossCollection join filter with a string query', () => {
    const filter = buildCollectionJoinFilter('id', 'search-index', 'legacy', '*:*', [])
    assert.deepStrictEqual(filter, {
      join: {
        from: 'id',
        to: 'ci_id_s',
        fromIndex: 'search-index',
        method: 'crossCollection',
        query: '*:*',
      },
    })
  })

  it('builds a new index join filter with checkRouterField disabled', () => {
    const filter = buildCollectionJoinFilter('ci_id_s', 'tr-passages-index', 'new', 'content_txt_en:foo', [])
    assert.deepStrictEqual(filter, {
      join: {
        from: 'ci_id_s',
        to: 'ci_id_s',
        fromIndex: 'tr-passages-index',
        method: 'index',
        checkRouterField: 'false',
        query: 'content_txt_en:foo',
      },
    })
  })

  it('embeds string filters as filter() clauses in the join subquery', () => {
    const filter = buildCollectionJoinFilter('id', 'search-index', 'legacy', 'content_txt_en:foo', [
      'lg_s:en',
      'meta_journal_s:JDG',
    ])
    assert.deepStrictEqual(filter, {
      join: {
        from: 'id',
        to: 'ci_id_s',
        fromIndex: 'search-index',
        method: 'crossCollection',
        query: 'content_txt_en:foo AND filter(lg_s:en) AND filter(meta_journal_s:JDG)',
      },
    })
  })

  it('serialises a bool query node instead of stringifying it to [object Object]', () => {
    const query: SolrQueryNode = {
      bool: {
        should: ['content_txt_en:foo', 'content_txt_de:foo'],
        minimum_should_match: 1,
      },
    }
    const filter = buildCollectionJoinFilter('id', 'search-index', 'legacy', query, [])
    assert.deepStrictEqual(filter, {
      join: {
        from: 'id',
        to: 'ci_id_s',
        fromIndex: 'search-index',
        method: 'crossCollection',
        query: '(content_txt_en:foo OR content_txt_de:foo)',
      },
    })
  })

  it('serialises bool filter nodes (e.g. exclude filters) into the join subquery', () => {
    const negation: SolrQueryNode = { bool: { must: ['*:*'], must_not: ['lg_s:en'] } }
    const filter = buildCollectionJoinFilter('id', 'search-index', 'legacy', '*:*', [negation])
    assert.deepStrictEqual(filter, {
      join: {
        from: 'id',
        to: 'ci_id_s',
        fromIndex: 'search-index',
        method: 'crossCollection',
        query: '*:* AND filter((*:* AND NOT lg_s:en))',
      },
    })
  })

  it('keeps $-variable references intact for request-level parameter dereferencing', () => {
    const filter = buildCollectionJoinFilter('id', 'search-index', 'legacy', '$v0', [])
    assert.deepStrictEqual(filter, {
      join: {
        from: 'id',
        to: 'ci_id_s',
        fromIndex: 'search-index',
        method: 'crossCollection',
        query: '$v0',
      },
    })
  })

  it('falls back to *:* when query and filters are empty', () => {
    const filter = buildCollectionJoinFilter('id', 'search-index', 'legacy', '', [])
    assert.deepStrictEqual(filter, {
      join: {
        from: 'id',
        to: 'ci_id_s',
        fromIndex: 'search-index',
        method: 'crossCollection',
        query: '*:*',
      },
    })
  })

  it('throws a descriptive error when a node cannot be embedded in a join subquery', () => {
    assert.throws(
      () => buildCollectionJoinFilter('id', 'search-index', 'legacy', { bool: {} }, []),
      new InvalidArgumentError('Cannot serialise an empty bool query node to a query string')
    )
  })
})
