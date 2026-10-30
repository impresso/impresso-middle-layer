import assert from 'node:assert/strict'
import { extractFirstAvailableValue } from '@/models/content-item.js'

describe('extractFirstAvailableValue', () => {
  it('returns undefined for undefined', () => {
    assert.equal(extractFirstAvailableValue(undefined), undefined)
  })

  it('returns undefined for an empty array', () => {
    assert.equal(extractFirstAvailableValue([]), undefined)
  })

  it('returns the only value of an array with one element', () => {
    assert.equal(extractFirstAvailableValue(['only value']), 'only value')
  })

  it('returns a single string as is', () => {
    assert.equal(extractFirstAvailableValue('single value'), 'single value')
  })
})
