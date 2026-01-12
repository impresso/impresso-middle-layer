import assert from 'assert'
import { aggregateFiltersByType } from '@/logic/filters/impressoPy.js'
import { Filter } from 'impresso-jscommons'

describe('aggregateFiltersByType', () => {
  it('should return an empty array when given an empty array', () => {
    const result = aggregateFiltersByType([])
    assert.deepEqual(result, [])
  })

  it('should return the same filter when given a single filter', () => {
    const filter: Filter = {
      type: 'string',
      q: 'test',
      op: 'AND',
    }
    const result = aggregateFiltersByType([filter])
    assert.deepEqual(result, [filter])
  })

  it('should aggregate string filters with the same operator', () => {
    const filters: Filter[] = [
      {
        type: 'string',
        q: 'test1',
        op: 'AND',
      },
      {
        type: 'string',
        q: 'test2',
        op: 'AND',
      },
    ]
    const expected: Filter[] = [
      {
        type: 'string',
        q: ['test1', 'test2'],
        op: 'AND',
      },
    ]
    const result = aggregateFiltersByType(filters)
    assert.deepEqual(result, expected)
  })

  it('should merge string filters with different operators as AND', () => {
    const filters: Filter[] = [
      {
        type: 'string',
        q: 'test1',
        op: 'AND',
      },
      {
        type: 'string',
        q: 'test2',
        op: 'OR',
      },
    ]
    const expected: Filter[] = [
      {
        type: 'string',
        q: ['test1', 'test2'],
        op: 'AND',
      },
    ]
    const result = aggregateFiltersByType(filters)
    assert.deepEqual(result, expected)
  })

  it('should handle array values in string filters', () => {
    const filters: Filter[] = [
      {
        type: 'string',
        q: ['test1', 'test2'],
        op: 'AND',
      },
      {
        type: 'string',
        q: 'test3',
        op: 'AND',
      },
    ]
    const expected: Filter[] = [
      {
        type: 'string',
        q: ['test1', 'test2', 'test3'],
        op: 'AND',
      },
    ]
    const result = aggregateFiltersByType(filters)
    assert.deepEqual(result, expected)
  })

  it('should handle array values with different operators in string filters', () => {
    const filters: Filter[] = [
      {
        type: 'string',
        q: ['test1', 'test2'],
        op: 'OR',
      },
      {
        type: 'string',
        q: 'test3',
        op: 'AND',
      },
    ]
    const expected: Filter[] = [
      {
        type: 'string',
        q: ['test1', 'test2'],
        op: 'OR',
      },
      {
        type: 'string',
        q: 'test3',
        op: 'AND',
      },
    ]
    const result = aggregateFiltersByType(filters)
    assert.deepEqual(result, expected)
  })

  it('should aggregate different filter types separately', () => {
    const filters: Filter[] = [
      {
        type: 'string',
        q: 'test',
        op: 'AND',
      },
      {
        type: 'newspaper',
        q: 'gazette',
        op: 'AND',
      },
    ]
    const expected: Filter[] = [
      {
        type: 'string',
        q: 'test',
        op: 'AND',
      },
      {
        type: 'newspaper',
        q: 'gazette',
        op: 'AND',
      },
    ]
    const result = aggregateFiltersByType(filters)
    assert.deepEqual(result, expected)
  })

  it('should preserve precision and context from the first filter of a type', () => {
    const filters: Filter[] = [
      {
        type: 'string',
        q: 'test1',
        op: 'AND',
        precision: 'fuzzy',
        context: 'exclude',
      },
      {
        type: 'string',
        q: 'test2',
        op: 'AND',
      },
    ]
    const expected: Filter[] = [
      {
        type: 'string',
        q: ['test1', 'test2'],
        op: 'AND',
        precision: 'fuzzy',
        context: 'exclude',
      },
    ]
    const result = aggregateFiltersByType(filters)
    assert.deepEqual(result, expected)
  })

  it('should skip filters with undefined q values', () => {
    const filters: Filter[] = [
      {
        type: 'string',
        q: 'test',
        op: 'AND',
      },
      {
        type: 'language',
        q: undefined,
        op: 'AND',
      },
    ]
    const expected: Filter[] = [
      {
        type: 'string',
        q: 'test',
        op: 'AND',
      },
    ]
    const result = aggregateFiltersByType(filters)
    assert.deepEqual(result, expected)
  })

  it('should handle a complex mix of filters', () => {
    const filters: Filter[] = [
      {
        type: 'string',
        q: 'test1',
        op: 'AND',
      },
      {
        type: 'string',
        q: 'test2',
        op: 'OR',
      },
      {
        type: 'newspaper',
        q: 'gazette1',
        op: 'AND',
      },
      {
        type: 'newspaper',
        q: 'gazette2',
        op: 'AND',
      },
      {
        type: 'daterange',
        q: ['1900-01-01', '1950-12-31'],
        op: 'AND',
      },
    ]
    const expected: Filter[] = [
      {
        type: 'string',
        q: ['test1', 'test2'],
        op: 'AND',
      },
      {
        type: 'newspaper',
        q: ['gazette1', 'gazette2'],
        op: 'AND',
      },
      {
        type: 'daterange',
        q: ['1900-01-01', '1950-12-31'],
        op: 'AND',
      },
    ]
    const result = aggregateFiltersByType(filters)
    assert.deepEqual(result, expected)
  })
})
