import { JSONPath } from 'jsonpath-plus'

export type Redactable = Record<string, any>
export type ValueConverter = (value: any) => any

export type DefaultConvertersNames = 'redact' | 'contextNotAllowedImage' | 'remove'

export interface RedactionPolicyItem {
  jsonPath: string
  valueConverterName: DefaultConvertersNames
}

export interface RedactionPolicy {
  name: string
  items: RedactionPolicyItem[]
}

const DefaultConverters: Record<DefaultConvertersNames, ValueConverter> = {
  redact: value => '[REDACTED]',
  contextNotAllowedImage: value => 'https://impresso-project.ch/assets/images/not-allowed.png',
  remove: value => undefined,
}

export const redactObject = (object: Redactable, policy: RedactionPolicy): Redactable => {
  if (typeof object !== 'object' || object === null || Array.isArray(object)) {
    throw new Error('The provided object is not Redactable')
  }

  const objectCopy = JSON.parse(JSON.stringify(object))

  policy.items.forEach(item => {
    JSONPath({
      path: item.jsonPath,
      json: objectCopy,
      resultType: 'value',
      callback: (value, type, payload) => {
        const valueConverter = DefaultConverters[item.valueConverterName]
        payload.parent[payload.parentProperty] = valueConverter(value)
      },
    })
  })

  return objectCopy
}
