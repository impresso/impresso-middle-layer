import { JSONPath } from 'jsonpath-plus'
import { cloneForRedaction } from './cloneForRedaction.js'
import { sanitizeIiifImageUrl } from '@/util/iiif.js'
import type { ImageUrlRewriteRule } from '@/models/generated/app/configuration.js'
/**
 * Represents a redactable object with arbitrary string keys and values.
 * The `symbol` keys are for internal use (like the `AuthorizationBitmapsKey`).
 */
export type Redactable = Record<string | symbol, any>
export type ValueConverter = (value: any, rewriteRules?: ImageUrlRewriteRule[]) => any

export type DefaultConvertersNames = 'redact' | 'contextNotAllowedImage' | 'remove' | 'emptyArray' | 'emptyObject'

export interface RedactionPolicyItem {
  jsonPath: string
  valueConverterName: DefaultConvertersNames
}

export interface RedactionPolicy {
  name: string
  items: RedactionPolicyItem[]
}

export const DefaultConverters: Record<DefaultConvertersNames, ValueConverter> = {
  redact: _value => '[REDACTED]',
  contextNotAllowedImage: (value, rewriteRules) =>
    sanitizeIiifImageUrl('https://impresso-project.ch/assets/images/not-allowed.png', rewriteRules ?? []),
  remove: value => undefined,
  emptyArray: value => [],
  emptyObject: value => ({}),
}

/**
 * Redacts sensitive information from the provided object based on the specified redaction policy.
 */
export function redactObject<T extends Redactable>(object: T, policy: RedactionPolicy, rules?: ImageUrlRewriteRule[]): T
export function redactObject(object: Redactable, policy: RedactionPolicy, rules?: ImageUrlRewriteRule[]): unknown {
  if (typeof object !== 'object' || object === null || Array.isArray(object)) {
    throw new Error('The provided object is not Redactable')
  }

  const objectCopy = cloneForRedaction(object)
  if (objectCopy === undefined) throw new TypeError('The provided object has no JSON representation')
  // A custom toJSON may return a bigint; it has no object properties to redact.
  if (typeof objectCopy === 'bigint') return objectCopy

  policy.items.forEach(item => {
    const valueConverter = DefaultConverters[item.valueConverterName]
    // JSONPath already caches parsed expressions; preserve policy order and its
    // callback traversal semantics rather than maintaining a second path cache.
    JSONPath({
      path: item.jsonPath,
      json: objectCopy,
      resultType: 'value',
      callback: (value, type, payload) => {
        payload.parent[payload.parentProperty] = valueConverter(value, rules)
      },
    })
  })

  return objectCopy
}
