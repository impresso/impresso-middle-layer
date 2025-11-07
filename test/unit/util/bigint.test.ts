import {
  bigIntToBitString,
  bigIntToBuffer,
  bigIntToLongString,
  bitmapsAlign,
  bufferToBigInt,
} from '../../../src/util/bigint'
import assert from 'assert'

const testBigInts: [bigint, string][] = [
  [BigInt(0), 'AAAAAAAAAAA='],
  [BigInt(1), 'AAAAAAAAAAE='],
  [BigInt('0b' + '1' + [...Array(63)].map(() => '0').join('')), 'gAAAAAAAAAA='],
  [BigInt('0b' + '1' + [...Array(62)].map(() => '0').join('') + '1'), 'gAAAAAAAAAE='],
  [BigInt('0b' + [...Array(64)].map(() => '1').join('')), '//////////8='],
]

function bufferToBinaryString(buffer) {
  return buffer
    .toString('hex')
    .match(/.{1,2}/g)
    .map(byte => parseInt(byte, 16).toString(2).padStart(8, '0'))
    .join(' ')
}

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
