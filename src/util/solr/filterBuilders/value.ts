import { Filter } from '@/models/index.js'
import baseFilterBuilderFn, {
  defaultItemBuilder,
  noPrefixFilterFieldConverter,
} from '@/util/solr/filterBuilders/base.js'
import { FilterBuilderFn, FilterField } from '@/util/solr/filterBuilders/types.js'

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

/**
 * Escapes non-alphanumeric characters
 * by percent-encoding them. Alphanumeric characters remain intact.
 */
function customEscape(str: string) {
  let result = ''
  for (let i = 0; i < str.length; i++) {
    const ch = str[i]
    // \p{L} matches any kind of letter from any language,
    // \p{N} matches any kind of numeric character.
    if (/[\p{L}\p{N}]/u.test(ch)) {
      result += ch
    } else {
      result += escape(ch)
    }
  }
  return result
}

/**
 * Converts a percent-encoded string back to its original form.
 */
function customUnescape(str: string) {
  return decodeURIComponent(str)
}

export const escapeIdValue = (value: string) => {
  return customEscape(value).replace(/%([0-9a-f]{2})/gi, (_, hex) => `$${hex.toLowerCase()}$`)
}

export const unescapeIdValue = (value: string) => {
  return customUnescape(value.replace(/\$([0-9a-f]{2})\$/gi, '%$1'))
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
