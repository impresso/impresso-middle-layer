import { strict as assert } from 'assert'
import { buildSearchEntitiesSolrQuery } from '@/services/entities/logic.js'
import type { Filter } from 'impresso-jscommons'

describe('entities/logic', () => {
  describe('buildSearchEntitiesSolrQuery', () => {
    it('returns a query with no filters', () => {
      const result = buildSearchEntitiesSolrQuery(
        {
          filters: [],
        },
        [],
        {}
      )

      assert.deepStrictEqual(result, {
        query: '*:*',
        filter: [],
        params: {
          hl: true,
          'hl.fl': 'entitySuggest',
          fl: 'id, default_label_s, ner_entity_type_s, content_item_count_l, mention_count_l',
        },
      })
    })

    it('builds a query with filters', () => {
      const filters: Filter[] = [
        { type: 'type', q: 'person' },
        { type: 'string', q: 'Einstein' },
      ]

      const result = buildSearchEntitiesSolrQuery(
        {
          filters,
        },
        [],
        {}
      )

      assert.equal(result.query, 'entitySuggest:Einstein*')
      assert.deepEqual(result.filter, ['ner_entity_type_s:pers'])
      assert.ok((result.query as string).length > 0)
      assert.deepStrictEqual(result.params, {
        hl: true,
        'hl.fl': 'entitySuggest',
        fl: 'id, default_label_s, ner_entity_type_s, content_item_count_l, mention_count_l',
      })
    })

    it('includes orderBy when provided', () => {
      const result = buildSearchEntitiesSolrQuery(
        {
          filters: [],
          orderBy: 'content_item_count_l desc',
        },
        [],
        {}
      )

      assert.deepStrictEqual(result, {
        query: '*:*',
        filter: [],
        params: {
          hl: true,
          'hl.fl': 'entitySuggest',
          fl: 'id, default_label_s, ner_entity_type_s, content_item_count_l, mention_count_l',
        },
        sort: 'content_item_count_l desc',
      })
    })

    it('includes limit when provided', () => {
      const result = buildSearchEntitiesSolrQuery(
        {
          filters: [],
          limit: 10,
        },
        [],
        {}
      )

      assert.deepStrictEqual(result, {
        query: '*:*',
        filter: [],
        params: {
          hl: true,
          'hl.fl': 'entitySuggest',
          fl: 'id, default_label_s, ner_entity_type_s, content_item_count_l, mention_count_l',
        },
        limit: 10,
      })
    })

    it('includes offset when provided', () => {
      const result = buildSearchEntitiesSolrQuery(
        {
          filters: [],
          offset: 20,
        },
        [],
        {}
      )

      assert.deepStrictEqual(result, {
        query: '*:*',
        filter: [],
        params: {
          hl: true,
          'hl.fl': 'entitySuggest',
          fl: 'id, default_label_s, ner_entity_type_s, content_item_count_l, mention_count_l',
        },
        offset: 20,
      })
    })

    it('includes all optional parameters when provided', () => {
      const result = buildSearchEntitiesSolrQuery(
        {
          filters: [],
          orderBy: 'content_item_count_l desc',
          limit: 10,
          offset: 20,
        },
        [],
        {}
      )

      assert.deepStrictEqual(result, {
        query: '*:*',
        filter: [],
        params: {
          hl: true,
          'hl.fl': 'entitySuggest',
          fl: 'id, default_label_s, ner_entity_type_s, content_item_count_l, mention_count_l',
        },
        sort: 'content_item_count_l desc',
        limit: 10,
        offset: 20,
      })
    })
  })
})
