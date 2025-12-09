import assert from 'assert'
import { customJSONReplacer, CustomEncoder, safeParseJson, safeStringifyJson } from '../../../src/util/jsonCodec'

describe('jsonCodec', () => {
  describe('customJSONReplacer', () => {
    it('should convert BigInt to string', () => {
      const bigIntValue = BigInt('9007199254740991')
      const result = customJSONReplacer('test', bigIntValue)
      assert.strictEqual(result, '9007199254740991')
    })

    it('should return original value for non-BigInt types', () => {
      const testCases = [123, 'string', true, { key: 'value' }, [1, 2, 3], null]

      testCases.forEach(value => {
        const result = customJSONReplacer('test', value)
        assert.strictEqual(result, value)
      })
    })
  })

  describe('CustomEncoder', () => {
    it('should create encoder instance with customJSONReplacer', () => {
      const encoder = new CustomEncoder()
      assert(encoder instanceof CustomEncoder)
    })

    it('should properly encode object with BigInt', () => {
      const encoder = new CustomEncoder()
      const testObj = { id: BigInt('9007199254740991') }
      const encoded = JSON.stringify(testObj, customJSONReplacer)
      assert.strictEqual(encoded, '{"id":"9007199254740991"}')
    })
  })

  describe('safeParseJson', () => {
    it('should convert unsafe integers to BigInt', () => {
      const json = '{"unsafe":9223372036854775807,"safe":123,"s":"123"}'
      const result = safeParseJson(json)

      assert(typeof result.unsafe === 'bigint')
      assert(typeof result.safe === 'number')
      assert.strictEqual(result.unsafe, BigInt('9223372036854775807'))
      assert.strictEqual(result.safe, 123)
      assert.strictEqual(result.s, '123')
    })

    it('should handle nested objects and arrays', () => {
      const json = '{"nested":{"unsafe":9223372036854775807},"arr":[9223372036854775807]}'
      const result = safeParseJson(json)

      assert.strictEqual(result.nested.unsafe, BigInt('9223372036854775807'))
      assert.strictEqual(result.arr[0], BigInt('9223372036854775807'))
    })
  })

  describe('safeStringifyJson', () => {
    it('should stringify object with BigInt values', () => {
      const obj = {
        bigInt: BigInt('9223372036854775807'),
        number: 123,
        string: 'test',
      }
      const result = safeStringifyJson(obj)
      assert.strictEqual(result, '{"bigInt":9223372036854775807,"number":123,"string":"test"}')
    })

    it('should handle nested objects with BigInt values', () => {
      const obj = {
        nested: {
          bigInt: BigInt('9223372036854775807'),
        },
        arr: [BigInt('9223372036854775807')],
      }
      const result = safeStringifyJson(obj)
      assert.strictEqual(result, '{"nested":{"bigInt":9223372036854775807},"arr":[9223372036854775807]}')
    })

    it('should handle arrays of mixed types', () => {
      const arr = [BigInt('9223372036854775807'), 123, 'test', { bigInt: BigInt('9223372036854775807') }]
      const result = safeStringifyJson(arr)
      assert.strictEqual(result, '[9223372036854775807,123,"test",{"bigInt":9223372036854775807}]')
    })

    it('should handle null and undefined values', () => {
      const obj = {
        nullValue: null,
        undefinedValue: undefined,
        bigInt: BigInt('9223372036854775807'),
      }
      const result = safeStringifyJson(obj)
      assert.strictEqual(result, '{"nullValue":null,"bigInt":9223372036854775807}')
    })

    it('should handle round trip from safeStringifyJson to safeParseJson', () => {
      const original = {
        bigInt: BigInt('9223372036854775807'),
        nested: {
          unsafe: BigInt('9223372036854775807'),
          safe: 123,
          string: 'test',
        },
        array: [BigInt('9223372036854775807'), 456, 'test'],
        string: 'test',
      }

      const stringified = safeStringifyJson(original)
      const parsed = safeParseJson(stringified)

      assert.deepEqual(parsed, original)
    })
  })
})
