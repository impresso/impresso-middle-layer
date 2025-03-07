import { JSONPath } from 'jsonpath-plus'
import { safeParseJson, safeStringifyJson } from './jsonCodec'
import { sanitizeIiifImageUrl } from '../util/iiif'
import { ImageUrlRewriteRule } from '../models/generated/common'
import { ImpressoApplication } from '../types'
/**
 * Represents a redactable object with arbitrary string keys and values.
 * The `symbol` keys are for internal use (like the `AuthorizationBitmapsKey`).
 */
export type Redactable = Record<string | symbol, any>
export type ValueConverter = (value: any, rewriteRules?: ImageUrlRewriteRule[]) => any

export type DefaultConvertersNames = 'redact' | 'contextNotAllowedImage' | 'remove' | 'emptyArray'

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
    rewriteRules
      ? sanitizeIiifImageUrl('https://impresso-project.ch/assets/images/not-allowed.png', rewriteRules)
      : 'https://impresso-project.ch/assets/images/not-allowed.png',
  remove: value => undefined,
  emptyArray: value => [],
}

/**
 * Redacts sensitive information from the provided object based on the specified redaction policy.
 */
export const redactObject = <T extends Redactable>(
  object: T,
  policy: RedactionPolicy,
  rules?: ImageUrlRewriteRule[]
): T => {
  if (typeof object !== 'object' || object === null || Array.isArray(object)) {
    throw new Error('The provided object is not Redactable')
  }

  const objectCopy = safeParseJson(safeStringifyJson(object))

  policy.items.forEach(item => {
    JSONPath({
      path: item.jsonPath,
      json: objectCopy,
      resultType: 'value',
      callback: (value, type, payload) => {
        const valueConverter = DefaultConverters[item.valueConverterName]
        payload.parent[payload.parentProperty] = valueConverter(value, rules)
      },
    })
  })

  return objectCopy
}
