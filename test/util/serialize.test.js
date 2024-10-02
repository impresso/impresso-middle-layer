import { getCacheKey } from '../../src/util/serialize'
import assert from 'assert'

describe('getCacheKey', () => {
  it('handles objects with symbols as keys', () => {
    const input = {
      [Symbol.for('foo')]: 'bar',
    }

    const result = getCacheKey(input)
    assert.strictEqual(atob(result), '{"Symbol(foo)":"bar"}')
  })
})
