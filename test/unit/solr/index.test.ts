import { ensureIdSort } from '@/util/solr/index.js'
import assert from 'node:assert/strict'

describe('ensureIdSort', () => {
  it('appends id asc when sort is empty', () => {
    assert.equal(ensureIdSort(''), 'id asc')
  })

  it('appends id asc when sort has no id clause', () => {
    assert.equal(ensureIdSort('score desc'), 'score desc, id asc')
  })

  it('appends id asc when sort has multiple clauses but no id', () => {
    assert.equal(ensureIdSort('score desc, date_i desc'), 'score desc, date_i desc, id asc')
  })

  it('leaves sort unchanged when id asc is already present', () => {
    assert.equal(ensureIdSort('score desc, id asc'), 'score desc, id asc')
  })

  it('leaves sort unchanged when id desc is already present', () => {
    assert.equal(ensureIdSort('score desc, id desc'), 'score desc, id desc')
  })

  it('leaves sort unchanged when id asc is the only clause', () => {
    assert.equal(ensureIdSort('id asc'), 'id asc')
  })

  it('leaves sort unchanged when id desc is the only clause', () => {
    assert.equal(ensureIdSort('id desc'), 'id desc')
  })

  it('does not match a field that merely contains "id" as a substring', () => {
    assert.equal(ensureIdSort('article_id asc'), 'article_id asc, id asc')
  })

  it('is case-insensitive for the direction keyword', () => {
    assert.equal(ensureIdSort('score desc, id ASC'), 'score desc, id ASC')
  })
})
