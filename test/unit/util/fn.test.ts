import { parallelLimit, groupBy, removeNullAndUndefined, setDifference, mapRecordValues, invertRecord } from '../../../src/util/fn'
import assert from 'assert'

describe('fn utilities', () => {
  describe('groupBy', () => {
    it('should group items by key', () => {
      const items = [
        { id: 1, category: 'A' },
        { id: 2, category: 'B' },
        { id: 3, category: 'A' },
      ]

      const result = groupBy(items, (item) => item.category)

      assert.deepStrictEqual(result['A'], [
        { id: 1, category: 'A' },
        { id: 3, category: 'A' },
      ])
      assert.deepStrictEqual(result['B'], [{ id: 2, category: 'B' }])
    })
  })

  describe('removeNullAndUndefined', () => {
    it('should remove null and undefined values', () => {
      const input = {
        a: 1,
        b: null,
        c: undefined,
        d: 'test',
      }

      const result = removeNullAndUndefined(input)

      assert.deepStrictEqual(result, { a: 1, d: 'test' })
    })

    it('should handle nested objects', () => {
      const input = {
        a: 1,
        nested: {
          x: null,
          y: 'value',
        },
      }

      const result = removeNullAndUndefined(input)

      assert.deepStrictEqual(result, { a: 1, nested: { y: 'value' } })
    })
  })

  describe('setDifference', () => {
    it('should find difference between sets', () => {
      const setA = new Set([1, 2, 3])
      const setB = new Set([2, 3, 4])

      const result = setDifference(setA, setB)

      assert.deepStrictEqual(result, new Set([1]))
    })

    it('should work with arrays', () => {
      const result = setDifference([1, 2, 3], [2, 3, 4])

      assert.deepStrictEqual(result, new Set([1]))
    })
  })

  describe('mapRecordValues', () => {
    it('should map record values', () => {
      const record = { a: 1, b: 2, c: 3 }

      const result = mapRecordValues(record, (v) => v * 2)

      assert.deepStrictEqual(result, { a: 2, b: 4, c: 6 })
    })
  })

  describe('invertRecord', () => {
    it('should invert record keys and values', () => {
      const record = { a: 'foo', b: 'bar' }

      const result = invertRecord(record)

      assert.deepStrictEqual(result, { foo: 'a', bar: 'b' })
    })
  })

  describe('parallelLimit', () => {
    it('should process all inputs', async () => {
      const inputs = [1, 2, 3, 4, 5]
      const results = await parallelLimit(inputs, async (n) => n * 2, 2)

      assert.deepStrictEqual(results, [2, 4, 6, 8, 10])
    })

    it('should maintain order of results', async () => {
      const inputs = [5, 3, 1, 4, 2]
      const results = await parallelLimit(inputs, async (n) => n * 2, 2)

      assert.deepStrictEqual(results, [10, 6, 2, 8, 4])
    })

    it('should enforce concurrency limit', async () => {
      const concurrencyLimit = 2
      let maxConcurrent = 0
      let currentConcurrent = 0

      const asyncFn = async (n: number) => {
        currentConcurrent++
        maxConcurrent = Math.max(maxConcurrent, currentConcurrent)
        await new Promise((resolve) => setTimeout(resolve, 50))
        currentConcurrent--
        return n * 2
      }

      const inputs = Array.from({ length: 10 }, (_, i) => i)
      await parallelLimit(inputs, asyncFn, concurrencyLimit)

      assert.strictEqual(maxConcurrent, concurrencyLimit, `Expected max concurrent to be ${concurrencyLimit}, but got ${maxConcurrent}`)
    })

    it('should handle single item', async () => {
      const results = await parallelLimit([42], async (n) => n * 2, 1)

      assert.deepStrictEqual(results, [84])
    })

    it('should handle empty array', async () => {
      const results = await parallelLimit([], async (n) => n * 2, 1)

      assert.deepStrictEqual(results, [])
    })

    it('should work with concurrency limit of 1', async () => {
      const inputs = [1, 2, 3, 4, 5]
      const results = await parallelLimit(inputs, async (n) => n * 2, 1)

      assert.deepStrictEqual(results, [2, 4, 6, 8, 10])
    })

    it('should handle large concurrency limit (higher than input count)', async () => {
      const inputs = [1, 2, 3]
      const results = await parallelLimit(inputs, async (n) => n * 2, 100)

      assert.deepStrictEqual(results, [2, 4, 6])
    })

    it('should correctly remove promises from executing array', async () => {
      const concurrencyLimit = 3
      const inputs = Array.from({ length: 10 }, (_, i) => i)
      let errorOccurred = false

      try {
        const results = await parallelLimit(inputs, async (n) => {
          await new Promise((resolve) => setTimeout(resolve, Math.random() * 50))
          return n * 2
        }, concurrencyLimit)

        assert.strictEqual(results.length, 10, 'All results should be returned')
        assert.deepStrictEqual(results, [0, 2, 4, 6, 8, 10, 12, 14, 16, 18])
      } catch (error) {
        errorOccurred = true
        throw error
      }

      assert.strictEqual(errorOccurred, false, 'No errors should occur during processing')
    })

    it('should handle async functions that throw errors', async () => {
      const inputs = [1, 2, 3, 4, 5]
      const asyncFn = async (n: number) => {
        if (n === 3) {
          throw new Error('Test error')
        }
        return n * 2
      }

      try {
        await parallelLimit(inputs, asyncFn, 2)
        assert.fail('Should have thrown an error')
      } catch (error: any) {
        assert.strictEqual(error.message, 'Test error')
      }
    })

    it('should throw when concurrency limit is less than 1', async () => {
      try {
        await parallelLimit([1, 2, 3], async (n) => n, 0)
        assert.fail('Should have thrown an error')
      } catch (error: any) {
        assert.strictEqual(error.message, 'concurrencyLimit must be at least 1')
      }
    })

    it('should process items in batches respecting concurrency', async () => {
      const concurrencyLimit = 2
      const inputs = [1, 2, 3, 4, 5, 6]
      const executionLog: number[] = []

      const asyncFn = async (n: number) => {
        executionLog.push(n)
        await new Promise((resolve) => setTimeout(resolve, 100))
        return n
      }

      await parallelLimit(inputs, asyncFn, concurrencyLimit)

      // Should have processed all items
      assert.strictEqual(executionLog.length, 6)
      assert.deepStrictEqual(executionLog.sort((a, b) => a - b), [1, 2, 3, 4, 5, 6])
    })
  })
})
