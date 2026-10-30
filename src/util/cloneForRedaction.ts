import { AuthorizationBitmapsKey, isAuthorizationBitmapsDTO } from '@/models/authorization.js'
import { assertSafeJsonProperty, safeParseJson } from './jsonCodec.js'

type JsonValue = null | boolean | number | string | bigint | JsonObject | JsonValue[]
interface JsonObject {
  [key: string]: JsonValue | undefined
  [key: symbol]: unknown
}

const isObject = (value: unknown): value is Record<string | symbol, unknown> =>
  value !== null && typeof value === 'object'

const copyAuthorization = (source: unknown, target: JsonObject): void => {
  if (!isObject(source)) return
  const bitmap = source[AuthorizationBitmapsKey]
  if (!isAuthorizationBitmapsDTO(bitmap)) return
  // Keep only the internal permission context; arbitrary symbols remain omitted.
  target[AuthorizationBitmapsKey] = {
    explore: bitmap.explore,
    getTranscript: bitmap.getTranscript,
    getImages: bitmap.getImages,
    getAudio: bitmap.getAudio,
  }
}

/** Match the JSON view used by policies without allocating and parsing a JSON string. */
const cloneValue = (input: unknown, key: string, ancestors: Set<object>): JsonValue | undefined => {
  let value = input
  if ((isObject(value) || typeof value === 'function') && 'toJSON' in value) {
    const toJSON = value.toJSON
    if (typeof toJSON === 'function') value = Reflect.apply(toJSON, value, [key])
  }
  if (value instanceof Number) value = Number(value)
  if (value instanceof String) value = String(value)
  if (value instanceof Boolean) value = Boolean.prototype.valueOf.call(value)
  if (value instanceof BigInt) throw new TypeError('Cannot serialize a boxed BigInt')
  if (JSON.isRawJSON(value)) return safeParseJson(value.rawJSON)

  if (value === null || typeof value === 'boolean' || typeof value === 'string') return value
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null
    if (value === 0) return 0
    // Match stringify -> lossless parse, including shortest-decimal formatting
    // of unsafe Numbers. At 1e21 stringify switches to exponent notation.
    if (Number.isInteger(value) && !Number.isSafeInteger(value) && Math.abs(value) < 1e21) return BigInt(String(value))
    return value
  }
  if (typeof value === 'bigint') {
    const number = Number(value)
    if (!Number.isFinite(number)) throw new SyntaxError('Bad number')
    return Number.isSafeInteger(number) ? number : value
  }
  if (!isObject(value)) return undefined
  if (ancestors.has(value)) throw new TypeError('Cannot clone a circular JSON value for redaction')
  ancestors.add(value)
  try {
    if (Array.isArray(value)) {
      const copy: JsonValue[] = []
      const length = value.length
      for (let index = 0; index < length; index++) {
        copy.push(cloneValue(value[index], String(index), ancestors) ?? null)
      }
      return copy
    }
    const copy: JsonObject = {}
    Object.setPrototypeOf(copy, null)
    for (const property of Object.keys(value)) {
      const child = cloneValue(value[property], property, ancestors)
      if (child === undefined) continue
      assertSafeJsonProperty(property)
      copy[property] = child
    }
    copyAuthorization(value, copy)
    if (value !== input) copyAuthorization(input, copy)
    return copy
  } finally {
    ancestors.delete(value)
  }
}

export const cloneForRedaction = (value: unknown): JsonValue | undefined => cloneValue(value, '', new Set())
