import { Filter } from '../../../models'
import baseFilterBuilderFn, { defaultItemBuilder, noPrefixFilterFieldConverter } from './base'
import { FilterBuilderFn, FilterField } from './types'
import { escapeString } from './value'

const toCapitalised = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1)
const transformValue = (value: string): string => escapeString(toCapitalised(value))

const valueBuilder: FilterBuilderFn = (filters: Filter[], filterField: FilterField, ruleName: string) => {
  return baseFilterBuilderFn(
    filters,
    filterField,
    ruleName,
    transformValue,
    defaultItemBuilder,
    noPrefixFilterFieldConverter
  )
}

export default valueBuilder
