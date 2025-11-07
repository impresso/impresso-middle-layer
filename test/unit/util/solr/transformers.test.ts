import assert from 'assert'
import { parseDPFS, asList, asNumberArray, toPairs } from '../../../../src/util/solr/transformers'

describe('parseDPFS', () => {
  it('returns empty array when dpfs is undefined', () => {
    const builder = (pair: [string, string]) => ({ id: pair[0], count: parseInt(pair[1]) })
    const result = parseDPFS(builder, undefined)
    assert.deepEqual(result, [])
  })

  it('returns empty array when dpfs is empty array', () => {
    const builder = (pair: [string, string]) => ({ id: pair[0], count: parseInt(pair[1]) })
    const result = parseDPFS(builder, [])
    assert.deepEqual(result, [])
  })

  it('parses single DPFS entry with builder function', () => {
    const builder = (pair: [string, string]) => ({ id: pair[0], count: parseInt(pair[1]) })
    const dpfs = ['entity1|5']
    const result = parseDPFS(builder, dpfs)
    assert.deepEqual(result, [{ id: 'entity1', count: 5 }])
  })

  it('parses multiple DPFS entries with builder function', () => {
    const builder = (pair: [string, string]) => ({ id: pair[0], count: parseInt(pair[1]) })
    const dpfs = ['entity1|5 entity2|10 entity3|2']
    const result = parseDPFS(builder, dpfs)
    assert.deepEqual(result, [
      { id: 'entity1', count: 5 },
      { id: 'entity2', count: 10 },
      { id: 'entity3', count: 2 },
    ])
  })

  it('handles DPFS entries with complex IDs containing special characters', () => {
    const builder = (pair: [string, string]) => ({ id: pair[0], count: parseInt(pair[1]) })
    const dpfs = ['aida-0001-50-Van_Etten_(town)|3 tm-de-all-v2.0_tp23_de|15']
    const result = parseDPFS(builder, dpfs)
    assert.deepEqual(result, [
      { id: 'aida-0001-50-Van_Etten_(town)', count: 3 },
      { id: 'tm-de-all-v2.0_tp23_de', count: 15 },
    ])
  })

  it('handles DPFS entries with zero counts', () => {
    const builder = (pair: [string, string]) => ({ id: pair[0], count: parseInt(pair[1]) })
    const dpfs = ['entity1|0 entity2|5']
    const result = parseDPFS(builder, dpfs)
    assert.deepEqual(result, [
      { id: 'entity1', count: 0 },
      { id: 'entity2', count: 5 },
    ])
  })

  it('works with different builder functions', () => {
    // Builder that creates a string format
    const stringBuilder = (pair: [string, string]) => `${pair[0]}:${pair[1]}`
    const dpfs = ['entity1|5 entity2|10']
    const result = parseDPFS(stringBuilder, dpfs)
    assert.deepEqual(result, ['entity1:5', 'entity2:10'])
  })

  it('works with builder that returns tuples', () => {
    const tupleBuilder = (pair: [string, string]) => pair
    const dpfs = ['entity1|5 entity2|10']
    const result = parseDPFS(tupleBuilder, dpfs)
    assert.deepEqual(result, [
      ['entity1', '5'],
      ['entity2', '10'],
    ])
  })

  it('handles single entry in DPFS string', () => {
    const builder = (pair: [string, string]) => ({ id: pair[0], count: parseInt(pair[1]) })
    const dpfs = ['entity1|42']
    const result = parseDPFS(builder, dpfs)
    assert.deepEqual(result, [{ id: 'entity1', count: 42 }])
  })

  it('handles entries with numeric IDs', () => {
    const builder = (pair: [string, string]) => ({ id: pair[0], count: parseInt(pair[1]) })
    const dpfs = ['123|5 456|10']
    const result = parseDPFS(builder, dpfs)
    assert.deepEqual(result, [
      { id: '123', count: 5 },
      { id: '456', count: 10 },
    ])
  })

  it('handles large count values', () => {
    const builder = (pair: [string, string]) => ({ id: pair[0], count: parseInt(pair[1]) })
    const dpfs = ['entity1|999999']
    const result = parseDPFS(builder, dpfs)
    assert.deepEqual(result, [{ id: 'entity1', count: 999999 }])
  })

  it('only processes first element of dpfs array', () => {
    const builder = (pair: [string, string]) => ({ id: pair[0], count: parseInt(pair[1]) })
    const dpfs = ['entity1|5 entity2|10', 'entity3|15 entity4|20']
    const result = parseDPFS(builder, dpfs)
    // Should only process the first string in the array
    assert.deepEqual(result, [
      { id: 'entity1', count: 5 },
      { id: 'entity2', count: 10 },
    ])
  })

  it('handles entries with IDs containing hyphens and underscores', () => {
    const builder = (pair: [string, string]) => ({ id: pair[0], count: parseInt(pair[1]) })
    const dpfs = ['entity-1_test|5 another_entity-2|10']
    const result = parseDPFS(builder, dpfs)
    assert.deepEqual(result, [
      { id: 'entity-1_test', count: 5 },
      { id: 'another_entity-2', count: 10 },
    ])
  })

  it('handles empty string as first element of dpfs array', () => {
    const builder = (pair: [string, string]) => ({ id: pair[0], count: parseInt(pair[1]) })
    const dpfs = ['']
    const result = parseDPFS(builder, dpfs)
    assert.deepEqual(result, [])
  })

  it('handles whitespace-only string as first element of dpfs array', () => {
    const builder = (pair: [string, string]) => ({ id: pair[0], count: parseInt(pair[1]) })
    const dpfs = ['   ']
    const result = parseDPFS(builder, dpfs)
    assert.deepEqual(result, [])
  })

  it('handles string with spaces in key of dpfs item', () => {
    const builder = (pair: [string, string]) => ({ id: pair[0], count: parseFloat(pair[1]) })
    const dpfs = ['entity with spaces|5.1 another entity|10.09']
    const result = parseDPFS(builder, dpfs)
    assert.deepEqual(result, [
      { id: 'entity with spaces', count: 5.1 },
      { id: 'another entity', count: 10.09 },
    ])
  })

  it('parses topic dpfs', () => {
    const builder = (pair: [string, string]) => ({ id: pair[0], count: parseFloat(pair[1]) })
    const dpfs = ['tm-de-all-v2.0_tp23_de|15']
    const result = parseDPFS(builder, dpfs)
    assert.deepEqual(result, [{ id: 'tm-de-all-v2.0_tp23_de', count: 15 }])
  })
})

describe('asList', () => {
  it('returns undefined for undefined input', () => {
    const result = asList(undefined)
    assert.deepEqual(result, undefined)
  })

  it('parses JSON string to array', () => {
    const result = asList<string>('["a", "b", "c"]')
    assert.deepEqual(result, ['a', 'b', 'c'])
  })

  it('returns array as-is when input is already an array', () => {
    const input = ['a', 'b', 'c']
    const result = asList(input)
    assert.strictEqual(result, input)
  })

  it('parses JSON string with numbers', () => {
    const result = asList<number>('[1, 2, 3]')
    assert.deepEqual(result, [1, 2, 3])
  })

  it('parses empty JSON array', () => {
    const result = asList('[]')
    assert.deepEqual(result, [])
  })
})

describe('asNumberArray', () => {
  it('returns undefined for undefined input', () => {
    const result = asNumberArray(undefined)
    assert.strictEqual(result, undefined)
  })

  it('parses JSON string to number array', () => {
    const result = asNumberArray('[1, 2, 3]')
    assert.deepEqual(result, [1, 2, 3])
  })

  it('returns number array as-is when input is already a number array', () => {
    const input = [1, 2, 3]
    const result = asNumberArray(input)
    assert.strictEqual(result, input)
  })

  it('parses empty JSON array', () => {
    const result = asNumberArray('[]')
    assert.deepEqual(result, [])
  })

  it('parses JSON string with floating point numbers', () => {
    const result = asNumberArray('[1.5, 2.7, 3.14]')
    assert.deepEqual(result, [1.5, 2.7, 3.14])
  })
})

describe('toPairs', () => {
  it('converts array to pairs with initial item', () => {
    const result = toPairs([2, 5, 9], 0)
    assert.deepEqual(result, [
      [0, 2],
      [2, 5],
      [5, 9],
    ])
  })

  it('handles single item array', () => {
    const result = toPairs([10], 0)
    assert.deepEqual(result, [[0, 10]])
  })

  it('handles empty array', () => {
    const result = toPairs([], 0)
    assert.deepEqual(result, [])
  })

  it('works with string arrays', () => {
    const result = toPairs(['b', 'c', 'd'], 'a')
    assert.deepEqual(result, [
      ['a', 'b'],
      ['b', 'c'],
      ['c', 'd'],
    ])
  })

  it('works with different initial item type', () => {
    const result = toPairs([1, 2, 3], -1)
    assert.deepEqual(result, [
      [-1, 1],
      [1, 2],
      [2, 3],
    ])
  })

  it('handles two item array', () => {
    const result = toPairs([5, 10], 0)
    assert.deepEqual(result, [
      [0, 5],
      [5, 10],
    ])
  })
})
