import assert from 'node:assert'
import {
  buildFindBySimilarEmbeddingsSolrQuery,
  buildGetTermEmbeddingVectorSolrQuery,
} from '@/services/embeddings/embeddings.class.js'

describe('buildGetTermEmbeddingVectorSolrQuery', () => {
  it('should return the correct query when language is not provided', () => {
    const term = 'test'
    // Assuming escapeValue returns the same input for simple strings
    const expected = `word_s:(${term})`
    const result = buildGetTermEmbeddingVectorSolrQuery(term)
    assert.strictEqual(result, expected)
  })

  it('should return the correct query when language is provided', () => {
    const term = 'test'
    const language = 'de'
    const expected = `word_s:(${term}) AND lg_s:${language}`
    const result = buildGetTermEmbeddingVectorSolrQuery(term, language)
    assert.strictEqual(result, expected)
  })

  it('should ignore empty language and return query only for term', () => {
    const term = 'sample'
    const language = ''
    const expected = `word_s:(${term})`
    const result = buildGetTermEmbeddingVectorSolrQuery(term, language)
    assert.strictEqual(result, expected)
  })
})

describe('buildFindBySimilarEmbeddingsSolrQuery', () => {
  it('should build query for a single vector', () => {
    const vectors = [[1, 2, 3]]
    const topK = 3
    const expected = '({!knn f=fastText_emb_v100 topK=3}[1,2,3])'
    const result = buildFindBySimilarEmbeddingsSolrQuery(vectors, topK)
    assert.strictEqual(result, expected)
  })

  it('should build query for multiple vectors', () => {
    const vectors = [
      [1, 2, 3],
      [4, 5, 6],
    ]
    const topK = 3
    const expected = '({!knn f=fastText_emb_v100 topK=3}[1,2,3]) OR ({!knn f=fastText_emb_v100 topK=3}[4,5,6])'
    const result = buildFindBySimilarEmbeddingsSolrQuery(vectors, topK)
    assert.strictEqual(result, expected)
  })
})
