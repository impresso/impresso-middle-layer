import { Filter } from '@/models/index.js'

export interface PrefixedFilterField {
  prefix: string
}

export type FilterField = string | string[] | PrefixedFilterField

export const isPrefixedFilterField = (field: FilterField): field is PrefixedFilterField => {
  return (field as PrefixedFilterField).prefix !== undefined
}

export const isMultiValueFilterField = (field: FilterField): field is string[] => {
  return Array.isArray(field)
}

/**
 * A filter descriptor entry in solrFilters.yml
 */
export interface FilterDescriptor {
  field: FilterField
  rule: string
}

export type ValueTransformer = (value: string) => string
export type ItemBuilder = (field: string, value: string) => string
export type FilterFieldConverter = (filterField: FilterField) => string[]

export type BaseFilterBuilderFn = (
  filters: Filter[],
  filterField: FilterField,
  ruleName: string,
  transformValue: ValueTransformer,
  buildItem: ItemBuilder,
  filterFieldConverter: FilterFieldConverter
) => string

export type FilterBuilderFn = (filters: Filter[], filterField: FilterField, ruleName: string) => string
