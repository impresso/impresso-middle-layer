import { Filter, protobuf } from 'impresso-jscommons'
import { isFilters } from './models'

export const parseOrderBy = (orderBy: string | undefined, keyFieldMap: Record<string, string> = {}) => {
  if (orderBy == null) return []
  const isDescending = orderBy?.startsWith('-')
  const orderKey = orderBy.replace(/^-/, '')
  const field = keyFieldMap[orderKey]
  return field != null ? [field, isDescending] : []
}

const parseFilterString = (filterStr: string): Filter[] => {
  try {
    return [JSON.parse(filterStr)]
  } catch (error) {
    const decoded = protobuf.searchQuery.deserialize(filterStr)
    const filters = decoded.filters as Filter[]
    return filters
  }
}

/**
 * Parse `filters` query parameter from different formats:
 *  - a list of stringifed objects
 *  - a single stringifed object
 *  - a protobuf serialized list of objects
 *
 * @return {object[]} List of filters as objects
 */
export const parseFilters = (value?: string | string[] | Filter[] | undefined): Filter[] => {
  if (value == null) return []

  if (typeof value === 'string') {
    return parseFilterString(value)
  } else if (Array.isArray(value) && value.every(item => typeof item === 'string')) {
    return value.map(parseFilterString).flat()
  }

  if (isFilters(value)) return value

  throw new Error(`Invalid filters parameter: ${JSON.stringify(value)}`)
}

export const parseFilter = (value?: string | string[] | undefined): Filter | undefined => {
  const filters = parseFilters(value)
  return filters.length > 0 ? filters[0] : undefined
}

/**
 * A comprehensive check to determine if a value represents a boolean true.
 * @param value The value to check.
 * @returns True if the value is considered true, false otherwise.
 */
export const isTrue = (value?: any): boolean => {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') {
    const lower = value.toLowerCase()
    return lower === 'true' || lower === '1'
  }
  if (typeof value === 'number') {
    return value === 1
  }
  return false
}
