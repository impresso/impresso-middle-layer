import { Encoder, Decoder } from 'socket.io-parser'

// Node 24 supports rawJSON, but the project's TypeScript libs do not declare it yet.
declare global {
  interface JSON {
    rawJSON(text: string): { readonly rawJSON: string }
  }
}

/**
 * A replacer that encodes bigint as strings.
 */
export const customJSONReplacer = (key: string, value: unknown) => {
  if (typeof value === 'bigint') {
    return value.toString(10)
  }
  return value
}

export class CustomEncoder extends Encoder {
  constructor() {
    super(customJSONReplacer)
  }
}

export class CustomDecoder extends Decoder {
  constructor() {
    super()
  }
}

const ForbiddenProperty = /__proto__|constructor/
const IntegerToken = /^-?\d+$/

const checkProperty = (key: string): void => {
  // Match the old codec's protection, including literal Unicode escapes in keys.
  const decodedKey = key.includes('\\u')
    ? key.replace(/\\u([\da-f]{4})/gi, (_match, digits: string) => String.fromCharCode(parseInt(digits, 16)))
    : key
  if (ForbiddenProperty.test(decodedKey)) throw new SyntaxError('Object contains forbidden property')
}

const isJsonObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

const losslessReviver = (key: string, value: unknown, context?: { source?: string }): unknown => {
  checkProperty(key)
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new SyntaxError('Bad number')
    if (!Number.isSafeInteger(value)) {
      const source = context?.source
      if (source == null) throw new Error('Lossless JSON parsing requires Node.js 24 or newer')
      // Decimal and exponent tokens retain the old codec's Number representation.
      if (IntegerToken.test(source)) return BigInt(source)
    }
  } else if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    // Preserve the null-prototype objects returned by the previous parser.
    Object.setPrototypeOf(value, null)
  }
  return value
}

const numericBigIntReplacer = (_key: string, value: unknown) =>
  typeof value === 'bigint' ? JSON.rawJSON(value.toString(10)) : value

export const safeParseJson = (json: string) => {
  const parsed = JSON.parse(json)
  const pending: unknown[] = [parsed]
  while (pending.length > 0) {
    const value = pending.pop()
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) throw new SyntaxError('Bad number')
      // Avoid a source-aware reviver on ordinary payloads: it allocates context
      // for every value. Only reparse when an integer may have lost precision.
      if (Number.isInteger(value) && !Number.isSafeInteger(value)) return JSON.parse(json, losslessReviver)
    } else if (Array.isArray(value)) {
      for (const child of value) pending.push(child)
    } else if (isJsonObject(value)) {
      Object.setPrototypeOf(value, null)
      for (const key of Object.keys(value)) {
        checkProperty(key)
        pending.push(value[key])
      }
    }
  }
  return parsed
}

export const safeStringifyJson = (value: unknown, space?: number) => {
  return JSON.stringify(value, numericBigIntReplacer, space)
}
