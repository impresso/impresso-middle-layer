import assert from 'node:assert'
import {
  buildFindBySimilarEmbeddingsSolrQuery,
  buildGetTermEmbeddingVectorSolrQuery,
} from '../../src/services/embeddings/embeddings.class'

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
  it('should build query for a single vector without language', () => {
    const vectors = [[1, 2, 3]]
    const topK = 3
    // When no language is provided, the query is just the vectors condition.
    const expected = '({!knn f=fastText_emb_v100 topK=3}[1,2,3])'
    const result = buildFindBySimilarEmbeddingsSolrQuery(vectors, topK)
    assert.strictEqual(result, expected)
  })

  it('should build query for multiple vectors without language', () => {
    const vectors = [
      [1, 2, 3],
      [4, 5, 6],
    ]
    const topK = 3
    // The vectors condition is concatenated with " OR "
    const expected = '({!knn f=fastText_emb_v100 topK=3}[1,2,3]) OR ({!knn f=fastText_emb_v100 topK=3}[4,5,6])'
    const result = buildFindBySimilarEmbeddingsSolrQuery(vectors, topK)
    assert.strictEqual(result, expected)
  })

  it('should build query for a single vector with language', () => {
    const vectors = [[1, 2, 3]]
    const topK = 3
    const language = 'de'
    // When a language is provided, both parts are wrapped in parenthesis and joined by " AND "
    const part1 = '({!knn f=fastText_emb_v100 topK=3}[1,2,3])'
    const part2 = 'lg_s:de'
    const expected = `(${part1}) AND (${part2})`
    const result = buildFindBySimilarEmbeddingsSolrQuery(vectors, topK, language)
    assert.strictEqual(result, expected)
  })

  it('should build query for multiple vectors with language', () => {
    const vectors = [
      [1, 2, 3],
      [4, 5, 6],
    ]
    const topK = 3
    const language = 'de'
    const vectorsCondition = '({!knn f=fastText_emb_v100 topK=3}[1,2,3]) OR ({!knn f=fastText_emb_v100 topK=3}[4,5,6])'
    const languageCondition = 'lg_s:de'
    const expected = `(${vectorsCondition}) AND (${languageCondition})`
    const result = buildFindBySimilarEmbeddingsSolrQuery(vectors, topK, language)
    assert.strictEqual(result, expected)
  })
})
