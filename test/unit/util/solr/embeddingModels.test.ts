import { strict as assert } from 'assert'
import { SolrNamespaces } from '@/solr.js'
import {
  getEmbeddingFieldVectorPairs,
  getEmbeddingFields,
  getEmbeddingModelToFieldMap,
} from '@/util/solr/embeddingModels.js'

describe('embeddingModels', () => {
  it('returns mapping from solr namespace embeddingModels', () => {
    const namespaces = [
      {
        namespaceId: SolrNamespaces.Search,
        serverId: 'default',
        index: 'impresso',
        embeddingModels: [
          { model: 'gte-768', field: 'gte_multi_v768' },
          { model: 'gte-256', field: 'gte_multi_v256' },
        ],
      },
    ]

    const map = getEmbeddingModelToFieldMap(namespaces, SolrNamespaces.Search)
    const fields = getEmbeddingFields(namespaces, SolrNamespaces.Search)
    const pairs = getEmbeddingFieldVectorPairs(namespaces, SolrNamespaces.Search)

    assert.deepEqual(map, {
      'gte-768': 'gte_multi_v768',
      'gte-256': 'gte_multi_v256',
    })
    assert.deepEqual(fields, ['gte_multi_v768', 'gte_multi_v256'])
    assert.deepEqual(pairs, [
      { fieldName: 'gte_multi_v768', vectorName: 'gte-768' },
      { fieldName: 'gte_multi_v256', vectorName: 'gte-256' },
    ])
  })

  it('returns empty mapping when namespace has no embedding models and no YAML fallback', () => {
    const namespaces = [
      {
        namespaceId: SolrNamespaces.Search,
        serverId: 'default',
        index: 'impresso',
      },
    ]

    const map = getEmbeddingModelToFieldMap(namespaces, SolrNamespaces.Search)
    const fields = getEmbeddingFields(namespaces, SolrNamespaces.Search)
    const pairs = getEmbeddingFieldVectorPairs(namespaces, SolrNamespaces.Search)

    assert.deepEqual(map, {})
    assert.deepEqual(fields, [])
    assert.deepEqual(pairs, [])
  })
})
