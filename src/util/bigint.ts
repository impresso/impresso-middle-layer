import { toBufferBE, toBigIntBE } from 'bigint-buffer'

export const bigIntToBuffer = (value: bigint): Buffer => {
  return toBufferBE(value, 8)
}

export const bufferToBigInt = (buffer: Buffer): bigint => {
  return toBigIntBE(buffer)
}

export const bigIntToBase64Bytes = (value: bigint): string => {
  const buffer = bigIntToBuffer(value)
  return buffer.toString('base64')
}

/**
 * @returns a string representation of the bigint value as a bit string.
 * The string is padded to 64 bits.
 */
export const bigIntToBitString = (value: bigint): string => {
  return value.toString(2).padStart(64, '0')
}

/**
 * @returns a string representation of the bigint value as a decimal string.
 */
export const bigIntToLongString = (value: bigint): string => {
  return value.toString(10)
}

export const bitStringToBigInt = (bitString: string): bigint => {
  return BigInt(`0b${bitString}`)
}

const Zero = BigInt(0)

export const bitmapsAlign = (bitmap: bigint, mask: bigint): boolean => {
  return (bitmap & mask) != Zero
}

/**
 * A bitmap that allows all permissions.
 * Useful to assign to resources that do not declare any permissions.
 */
export const OpenPermissions = BigInt('0b' + [...Array(64)].map(() => '1').join(''))
