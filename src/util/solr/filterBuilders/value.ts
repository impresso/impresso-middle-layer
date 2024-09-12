import { Filter } from '../../../models'
import baseFilterBuilderFn, { defaultItemBuilder, noPrefixFilterFieldConverter } from './base'
import { FilterBuilderFn, FilterField } from './types'

export const escapeString = (s: string): string => s.replace(/[()\\+&|!{}[\]?:;,]/g, d => `\\${d}`)

const valueBuilder: FilterBuilderFn = (filters: Filter[], filterField: FilterField, ruleName: string) => {
  return baseFilterBuilderFn(
    filters,
    filterField,
    ruleName,
    escapeString,
    defaultItemBuilder,
    noPrefixFilterFieldConverter
  )
}

export default valueBuilder
