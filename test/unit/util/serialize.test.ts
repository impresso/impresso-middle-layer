import { getCacheKey } from '@/util/serialize.js'
import assert from 'assert'

describe('serialize', () => {
  describe('getCacheKey', () => {
    it('handles objects with symbols as keys', () => {
      const input = {
        [Symbol.for('foo')]: 'bar',
      }

      const result = getCacheKey(input)
      assert.strictEqual(atob(result), '{"Symbol(foo)":"bar"}')
    })
  })
})
