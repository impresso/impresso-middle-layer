import { FilterTypes } from '../data/constants'
import { Filter } from '../models/generated/shared'
import { FilterType, Filter as JSCommonsFilter } from 'impresso-jscommons'

const isFilterType = (value: any): value is FilterType => {
  return typeof value === 'string' && FilterTypes.includes(value as FilterType)
}

export const filterAdapter = (filter: Filter): JSCommonsFilter => {
  const { type, uids, ...rest } = filter
  if (!isFilterType(type)) throw new Error(`Unsupported filter type: ${type}`)

  return {
    ...rest,
    type,
    ...(uids != null ? { uids: Array.isArray(uids) ? uids : uids.split(',') } : {}),
  }
}

export const isFilters = (value: any): value is Filter[] => {
  if (!Array.isArray(value)) return false
  return value.every(item => typeof item === 'object' && item.type != null && isFilterType(item.type))
}
