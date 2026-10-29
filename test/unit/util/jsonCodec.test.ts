import { strict as assert } from 'assert'
import { customJSONReplacer, CustomEncoder, safeParseJson, safeStringifyJson } from '@/util/jsonCodec.js'
import { PacketType } from 'socket.io-parser'
import { bitmapsAlign } from '@/util/bigint.js'

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

    it('preserves string-valued bigints in Socket.io event packets', () => {
      const packets = new CustomEncoder().encode({
        type: PacketType.EVENT,
        nsp: '/',
        data: ['event', { bitmap: 9223372036854775807n }],
      })
      assert.deepEqual(packets, ['2["event",{"bitmap":"9223372036854775807"}]'])
    })
  })

  describe('safeParseJson', () => {
    it('preserves integer precision and types at safe-integer and 64-bit boundaries', () => {
      for (const token of [
        '9007199254740991',
        '9007199254740992',
        '9007199254740993',
        '-9007199254740991',
        '-9007199254740992',
        '-9007199254740993',
        '9223372036854775807',
        '-9223372036854775808',
        '18446744073709551615',
      ]) {
        const expected = Number.isSafeInteger(Number(token)) ? Number(token) : BigInt(token)
        assert.equal(safeParseJson(token), expected)
        assert.equal(safeParseJson(`{"value":${token}}`).value, expected)
        assert.equal(safeParseJson(`[${token}]`)[0], expected)
      }
    })

    it('retains Number semantics for decimals and exponent notation', () => {
      for (const token of ['1.25', '-0', '9007199254740993.0', '9.007199254740993e15', '1e100', '1e-100']) {
        assert.ok(Object.is(safeParseJson(token), Number(token)), token)
      }
      assert.equal(safeParseJson('"9223372036854775807"'), '9223372036854775807')
    })

    it('keeps exact authorization bits that native Number parsing would round', () => {
      const result = safeParseJson(
        '{"rights_bm_explore_l":9223372036854775807,"rights_bm_get_img_l":9223372036854775809}'
      )
      assert.equal(bitmapsAlign(result.rights_bm_explore_l, 1n << 63n), false)
      assert.equal(bitmapsAlign(result.rights_bm_get_img_l, 1n), true)
    })

    it('retains null-prototype objects, nested arrays, and duplicate-key behavior', () => {
      const result = safeParseJson('{"nested":{"x":1},"array":[{"x":2}],"duplicate":1,"duplicate":2}')
      assert.equal(Object.getPrototypeOf(result), null)
      assert.equal(Object.getPrototypeOf(result.nested), null)
      assert.equal(Object.getPrototypeOf(result.array[0]), null)
      assert.ok(Array.isArray(result.array))
      assert.equal(result.duplicate, 2)
    })

    it('rejects forbidden property names, including Unicode-escaped variants', () => {
      for (const key of [
        '__proto__',
        'constructor',
        'reconstructor',
        String.raw`\u005f_proto__`,
        String.raw`constr\u0075ctor`,
        String.raw`\\u0063onstructor`,
      ]) {
        assert.throws(() => safeParseJson(`{"nested":{"${key}":1}}`), SyntaxError, key)
      }
    })

    it('rejects malformed JSON and non-finite numeric tokens', () => {
      for (const input of ['{"x":}', '[1,]', '01', 'undefined', '1e309', '-1e309']) {
        assert.throws(() => safeParseJson(input), SyntaxError, input)
      }
    })
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
    it('writes signed and unsigned bigint values as numeric JSON tokens, including root values', () => {
      for (const value of [
        0n,
        1n,
        -1n,
        9007199254740993n,
        9223372036854775807n,
        -9223372036854775808n,
        18446744073709551615n,
      ]) {
        assert.equal(safeStringifyJson(value), value.toString())
      }
      assert.equal(safeStringifyJson({ nested: [1n] }, 2), '{\n  "nested": [\n    1\n  ]\n}')
    })

    it('visits getters and toJSON exactly once, including values containing bigint', () => {
      let getterCalls = 0
      let toJSONCalls = 0
      const value = {
        get nested() {
          getterCalls++
          return {
            toJSON() {
              toJSONCalls++
              return { bitmap: 9223372036854775807n }
            },
          }
        },
      }
      assert.equal(safeStringifyJson(value), '{"nested":{"bitmap":9223372036854775807}}')
      assert.equal(getterCalls, 1)
      assert.equal(toJSONCalls, 1)
    })

    it('keeps JSON normalization of dates, omitted properties, array holes and non-finite numbers', () => {
      const value = {
        date: new Date('2024-01-01T00:00:00Z'),
        omit: undefined,
        list: [undefined, NaN, Infinity],
        [Symbol('internal')]: 1n,
      }
      assert.equal(safeStringifyJson(value), JSON.stringify(value))
      assert.equal(safeStringifyJson(undefined), undefined)
      assert.equal(safeStringifyJson(null), 'null')
    })

    it('rejects cyclic values', () => {
      const value: { self?: object } = {}
      value.self = value
      assert.throws(() => safeStringifyJson(value), TypeError)
    })
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

      assert.deepEqual({ ...parsed, nested: { ...parsed.nested } }, original)
    })
  })
})
