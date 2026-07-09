const BitmapByteLength = 8
const Zero = BigInt(0)

export const bigIntToBuffer = (value: bigint): Buffer => {
  const buffer = Buffer.alloc(BitmapByteLength)
  buffer.writeBigUInt64BE(value)
  return buffer
}

export const bufferToBigInt = (buffer: Buffer): bigint => {
  if (buffer.length === 0) return Zero
  if (buffer.length === BitmapByteLength) return buffer.readBigUInt64BE()
  return BigInt(`0x${buffer.toString('hex')}`)
}

export const bigIntToBase64Bytes = (value: bigint): string => {
  const buffer = bigIntToBuffer(value)
  return buffer.toString('base64')
}

export const base64BytesToBigInt = (base64: string): bigint => {
  const buffer = Buffer.from(base64, 'base64')
  return bufferToBigInt(buffer)
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

export const bitmapsAlign = (bitmap: bigint, mask: bigint): boolean => {
  return (bitmap & mask) != Zero
}

/**
 * A bitmap that allows all permissions.
 * Useful to assign to resources that do not declare any permissions.
 */
export const OpenPermissions = BigInt('0b' + [...Array(64)].map(() => '1').join(''))
