import { SelectRequest } from '../../src/internalServices/simpleSolr'
import { findByIds } from '../../src/solr/queryBuilders'
import assert from 'node:assert/strict'

describe('queryBuilders', () => {
  describe('findByIds', () => {
    it('fails with an empty list of IDs', () => {
      assert.throws(() => findByIds([]), /list of IDs cannot be empty/)
    })

    it('builds a query without fields', () => {
      assert.deepEqual(findByIds(['a', 'b']), {
        body: {
          query: 'id:a OR id:b',
          limit: 2,
        },
      } satisfies SelectRequest)
    })

    it('builds a query without fields for empty fields', () => {
      assert.deepEqual(findByIds(['a', 'b', 'c'], []), {
        body: {
          query: 'id:a OR id:b OR id:c',
          limit: 3,
        },
      } satisfies SelectRequest)
    })

    it('builds a query with fields', () => {
      assert.deepEqual(findByIds(['a', 'b', 'c'], ['foo', 'bar']), {
        body: {
          query: 'id:a OR id:b OR id:c',
          limit: 3,
          fields: 'foo,bar',
        },
      } satisfies SelectRequest)
    })

    it('builds a query for a single ID', () => {
      assert.deepEqual(findByIds(['a']), {
        body: {
          query: 'id:a',
          limit: 1,
        },
      } satisfies SelectRequest)
    })
  })
})
