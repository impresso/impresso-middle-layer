import {
  base64BytesToBigInt,
  bigIntToBase64Bytes,
  bigIntToBitString,
  bigIntToBuffer,
  bigIntToLongString,
  bitmapsAlign,
  bufferToBigInt,
} from '@/util/bigint.js'
import assert from 'assert'

const testBigInts: [bigint, string][] = [
  [BigInt(0), 'AAAAAAAAAAA='],
  [BigInt(1), 'AAAAAAAAAAE='],
  [BigInt('0b' + '1' + [...Array(63)].map(() => '0').join('')), 'gAAAAAAAAAA='],
  [BigInt('0b' + '1' + [...Array(62)].map(() => '0').join('') + '1'), 'gAAAAAAAAAE='],
  [BigInt('0b' + [...Array(64)].map(() => '1').join('')), '//////////8='],
]

const bigEndianBufferCases: [string, bigint][] = [
  ['', BigInt(0)],
  ['00', BigInt(0)],
  ['01', BigInt(1)],
  ['0001', BigInt(1)],
  ['0000000000000001', BigInt(1)],
  ['010000000000000000', BigInt('0x010000000000000000')],
  ['ffffffffffffffffff', BigInt('0xffffffffffffffffff')],
]

describe('bigint utils', () => {
  it('should convert bigint to buffer and back', () => {
    testBigInts.forEach(([bigint, base64Representation]) => {
      const buffer = bigIntToBuffer(bigint)
      assert.strictEqual(
        buffer.toString('base64'),
        base64Representation,
        ` bigint: ${bigint}, buffer: ${buffer.toString('hex')}`
      )
      const bigint2 = bufferToBigInt(buffer)
      assert.strictEqual(bigint, bigint2)
    })
  })

  it('decodes arbitrary-width big-endian buffers', () => {
    bigEndianBufferCases.forEach(([hexRepresentation, bigint]) => {
      const buffer = Buffer.from(hexRepresentation, 'hex')
      assert.strictEqual(bufferToBigInt(buffer), bigint, `buffer: ${hexRepresentation}`)
    })
  })

  it('round-trips base64 byte helpers', () => {
    testBigInts.forEach(([bigint, base64Representation]) => {
      assert.strictEqual(bigIntToBase64Bytes(bigint), base64Representation)
      assert.strictEqual(base64BytesToBigInt(base64Representation), bigint)
    })
  })

  it('rejects values outside the unsigned 64-bit buffer range', () => {
    assert.throws(() => bigIntToBuffer(BigInt(-1)), RangeError)
    assert.throws(() => bigIntToBuffer(BigInt('0x10000000000000000')), RangeError)
  })

  it('should represent bigint as a bit string', () => {
    const maxValue = BigInt('0b' + [...Array(64)].map(() => '1').join(''))
    const maxBitString = bigIntToBitString(maxValue)
    assert.strictEqual(maxBitString, '1111111111111111111111111111111111111111111111111111111111111111')

    const minValue = BigInt(0)
    const minBitString = bigIntToBitString(minValue)
    assert.strictEqual(minBitString, '0000000000000000000000000000000000000000000000000000000000000000')
  })

  it('should represent bigint as a long string', () => {
    const maxValue = BigInt('0b' + [...Array(64)].map(() => '1').join(''))
    const maxLongString = bigIntToLongString(maxValue)
    assert.strictEqual(maxLongString, '18446744073709551615')

    const minValue = BigInt(0)
    const minLongString = bigIntToLongString(minValue)
    assert.strictEqual(minLongString, '0')
  })

  it('checks bitmaps alignment', () => {
    assert.ok(bitmapsAlign(BigInt(0b0010), BigInt(0b1010)))
    assert.ok(bitmapsAlign(BigInt(0b0001), BigInt(0b0001)))
    assert.ok(!bitmapsAlign(BigInt(0b0001), BigInt(0b1000)))
    assert.ok(!bitmapsAlign(BigInt(0b0001), BigInt(0b0100)))
  })

  it('checks bitmap alignment for specific domains', () => {
    assert.ok(bitmapsAlign(BigInt(0b1000111), BigInt(64)))
    assert.ok(bitmapsAlign(BigInt(0b0000000000000000000000000000000000000000100000000000000000000001), BigInt(8388608)))
  })

  it('checks base64 encoded value', () => {
    const researcher = 'AAAAAAAAAAs='
    const buffer = Buffer.from(researcher, 'base64')
    const bigint = bufferToBigInt(buffer)
    assert.strictEqual(bigint.toString(2), BigInt(0b1011).toString(2))
    assert.strictEqual(bigIntToBuffer(bigint).toString('base64'), researcher)
  })
})
