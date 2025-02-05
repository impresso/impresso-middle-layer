import { Filter } from '../../../models'
import baseFilterBuilderFn, { defaultItemBuilder, noPrefixFilterFieldConverter } from './base'
import { FilterBuilderFn, FilterField } from './types'

export const escapeString = (s: string): string => s.replace(/[()\\+&|!{}[\]?:;,]/g, d => `\\${d}`)

export const valueBuilder: FilterBuilderFn = (filters: Filter[], filterField: FilterField, ruleName: string) => {
  return baseFilterBuilderFn(
    filters,
    filterField,
    ruleName,
    escapeString,
    defaultItemBuilder,
    noPrefixFilterFieldConverter
  )
}

export const escapeIdValue = (value: string) => {
  return escape(value).replace(/%([0-9a-f]{2})/gi, (_, hex) => `$${hex.toLowerCase()}$`)
}

export const unescapeIdValue = (value: string) => {
  return unescape(value.replace(/\$([0-9a-f]{2})\$/gi, '%$1'))
}

/**
 * Similar to `value` filter builder but uses a different escape function
 * designed to work with IDs. E.g.:
 * `aida-0001-50-Poseidon_(film)` -> `pers_entities_dpfs:aida-0001-50-Poseidon_$28$film$29$`
 */
export const idValueBuilder: FilterBuilderFn = (filters: Filter[], filterField: FilterField, ruleName: string) => {
  return baseFilterBuilderFn(
    filters,
    filterField,
    ruleName,
    // unescape before escaping, in case it has already been escaped
    x => escapeIdValue(unescapeIdValue(x)),
    defaultItemBuilder,
    noPrefixFilterFieldConverter
  )
}
