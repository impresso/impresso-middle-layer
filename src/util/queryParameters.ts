import lodash from 'lodash'
import { protobuf } from 'impresso-jscommons'
import { Filter } from '../models'

export const parseOrderBy = (orderBy: string | undefined, keyFieldMap: Record<string, string> = {}) => {
  if (orderBy == null) return []
  const isDescending = orderBy?.startsWith('-')
  const orderKey = orderBy.replace(/^-/, '')
  const field = keyFieldMap[orderKey]
  return field != null ? [field, isDescending] : []
}

/**
 * Parse `filters` query parameter from different formats:
 *  - a list of objects
 *  - a list of stringifed objects
 *  - a single object
 *  - a single stringifed object
 *  - a protobuf serialized list of objects
 *
 * @return {object[]} List of filters as objects
 */
export const parseFilters = (value?: string | string[] | object | object[]): Filter[] => {
  if (value == null) return []
  if (Array.isArray(value) && value.every(item => lodash.isObjectLike(item))) return value as Filter[]
  if (lodash.isObjectLike(value) && !Array.isArray(value)) return [value] as Filter[]

  if (lodash.isString(value)) {
    try {
      return [JSON.parse(value)]
    } catch (error) {
      const decoded = protobuf.searchQuery.deserialize(value)
      return decoded.filters as Filter[]
    }
  }

  if (Array.isArray(value) && value.every(item => lodash.isString(item))) {
    return value.map(item => JSON.parse(item as unknown as string))
  }

  return value as Filter[]
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
