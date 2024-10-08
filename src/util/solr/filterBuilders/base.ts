import { Filter } from '../../../models'
import {
  BaseFilterBuilderFn,
  FilterField,
  FilterFieldConverter,
  isMultiValueFilterField,
  isPrefixedFilterField,
  ItemBuilder,
  ValueTransformer,
} from './types'

interface FilterStatement<T> {
  items: T[]
  op: 'OR' | 'AND'
  negated?: boolean
}

const isArrayValue = (filterValue?: string | string[]): filterValue is string[] => Array.isArray(filterValue)
const isNonEmptyStringValue = (filterValue?: string | string[]): filterValue is string =>
  typeof filterValue === 'string' && filterValue.trim() !== ''

const toFilterStatements = (value: string, fields: string[], buildItem: ItemBuilder): FilterStatement<string> => {
  const items = fields.map(field => buildItem(field, value))
  return {
    items,
    op: 'OR',
  }
}

const filterAsFilterStatement = (
  filter: Filter,
  fields: string[],
  transformValue: ValueTransformer,
  buildItem: ItemBuilder
): FilterStatement<FilterStatement<string>> => {
  const op = filter.op || 'OR'
  const negated = filter.context === 'exclude'

  if (isArrayValue(filter.q)) {
    const values = filter.q.length > 0 ? filter.q : ['*']
    const items = values.map(value => toFilterStatements(transformValue(value), fields, buildItem))

    return {
      items,
      op,
      negated,
    }
  } else if (isNonEmptyStringValue(filter.q)) {
    const item = toFilterStatements(transformValue(filter.q), fields, buildItem)
    return {
      items: [item],
      op,
      negated,
    }
  } else {
    const item = toFilterStatements('*', fields, buildItem)
    return {
      items: [item],
      op,
      negated,
    }
  }
}

const filterStatementToString = (statement: FilterStatement<any> | string): string => {
  if (typeof statement === 'string') return statement

  const items = statement.items.map(filterStatementToString).filter(item => item.trim() !== '')
  const usedItems = items.length > 0 ? items : ['*:*']
  const str = usedItems.join(` ${statement.op} `)
  const groupedString = items.length > 1 ? `(${str})` : str
  return statement.negated ? `NOT ${groupedString}` : groupedString
}

/**
 * Transform string to string.
 */
export const identityTransformValue = <T>(v: T): T => v

/**
 * Default SOLR builder: field:value
 */
export const defaultItemBuilder = (field: string, value: string) => `${field}:${value}`

/**
 * Converter that prevents the use of prefixes in filter fields
 */
export const noPrefixFilterFieldConverter: FilterFieldConverter = filterField => {
  if (isPrefixedFilterField(filterField)) throw new Error(`Prefixed filter fields are not supported`)
  return isMultiValueFilterField(filterField) ? filterField : [filterField]
}

const baseFilterBuilderFn: BaseFilterBuilderFn = (
  filters: Filter[],
  filterField: FilterField,
  ruleName: string,
  transformValue: ValueTransformer = identityTransformValue,
  buildItem: ItemBuilder = defaultItemBuilder,
  filterFieldConverter: FilterFieldConverter = noPrefixFilterFieldConverter
): string => {
  try {
    const fields = filterFieldConverter(filterField)
    const statements = filters.map(filter => filterAsFilterStatement(filter, fields, transformValue, buildItem))

    const statement: FilterStatement<FilterStatement<FilterStatement<string>>> = {
      items: statements,
      op: 'AND',
    }

    return filterStatementToString(statement)
  } catch (e) {
    const error = e as Error
    const newError = new Error(`Error building filter for rule ${ruleName}: ${error.message}`)
    newError.stack = error.stack
    throw newError
  }
}

export default baseFilterBuilderFn
