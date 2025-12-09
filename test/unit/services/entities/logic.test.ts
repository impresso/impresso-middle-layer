import assert from 'assert'
import { buildSearchEntitiesSolrQuery } from '../../../../src/services/entities/logic'
import { Filter } from 'impresso-jscommons'

describe('entities/logic', () => {
  describe('buildSearchEntitiesSolrQuery', () => {
    it('returns a query with no filters', () => {
      const result = buildSearchEntitiesSolrQuery({
        filters: [],
      })

      assert.deepStrictEqual(result, {
        query: '*:*',
        filter: [],
        params: {
          hl: true,
          fl: 'id, l_s, t_s, article_fq_f, mention_fq_f',
        },
      })
    })

    it('builds a query with filters', () => {
      const filters: Filter[] = [
        { type: 'type', q: 'person' },
        { type: 'string', q: 'Einstein' },
      ]

      const result = buildSearchEntitiesSolrQuery({
        filters,
      })

      assert.equal(result.query, 'entitySuggest:Einstein*')
      assert.deepEqual(result.filter, ['t_s:pers'])
      assert.ok((result.query as string).length > 0)
      assert.deepStrictEqual(result.params, {
        hl: true,
        fl: 'id, l_s, t_s, article_fq_f, mention_fq_f',
      })
    })

    it('includes orderBy when provided', () => {
      const result = buildSearchEntitiesSolrQuery({
        filters: [],
        orderBy: 'article_fq_f desc',
      })

      assert.deepStrictEqual(result, {
        query: '*:*',
        filter: [],
        params: {
          hl: true,
          fl: 'id, l_s, t_s, article_fq_f, mention_fq_f',
        },
        sort: 'article_fq_f desc',
      })
    })

    it('includes limit when provided', () => {
      const result = buildSearchEntitiesSolrQuery({
        filters: [],
        limit: 10,
      })

      assert.deepStrictEqual(result, {
        query: '*:*',
        filter: [],
        params: {
          hl: true,
          fl: 'id, l_s, t_s, article_fq_f, mention_fq_f',
        },
        limit: 10,
      })
    })

    it('includes offset when provided', () => {
      const result = buildSearchEntitiesSolrQuery({
        filters: [],
        offset: 20,
      })

      assert.deepStrictEqual(result, {
        query: '*:*',
        filter: [],
        params: {
          hl: true,
          fl: 'id, l_s, t_s, article_fq_f, mention_fq_f',
        },
        offset: 20,
      })
    })

    it('includes all optional parameters when provided', () => {
      const result = buildSearchEntitiesSolrQuery({
        filters: [],
        orderBy: 'article_fq_f desc',
        limit: 10,
        offset: 20,
      })

      assert.deepStrictEqual(result, {
        query: '*:*',
        filter: [],
        params: {
          hl: true,
          fl: 'id, l_s, t_s, article_fq_f, mention_fq_f',
        },
        sort: 'article_fq_f desc',
        limit: 10,
        offset: 20,
      })
    })
  })
})
