export type FilterContext = 'include' | 'exclude'
export type FilterOperator = 'AND' | 'OR'
export type FilterType = string
export type FilterPrecision = 'exact' | 'partial' | 'fuzzy' | 'soft'

export interface Filter {
  context?: FilterContext
  op?: FilterOperator
  type: FilterType
  precision?: FilterPrecision
  q?: string | string[]
}
