import moment from 'moment'
import { Filter } from '../../models'

// Define interface for daterange filters specifically
interface DaterangeFilter extends Filter {
  type: 'daterange'
}

const DaterangeFilterValueRegex = /([^\s]+)\s+TO\s+([^\s]+)/

/**
 * Calculate the time delta in days for a daterange filter
 * @param daterangeFilter The daterange filter to analyze
 * @return The time delta in days or undefined if not applicable
 */
function getTimedeltaInDaterangeFilterAsDays(daterangeFilter: DaterangeFilter): number | undefined {
  const value = Array.isArray(daterangeFilter.q) ? daterangeFilter.q[0] : daterangeFilter.q
  const matches = DaterangeFilterValueRegex.exec(value ?? '')

  if (!matches || matches.length !== 3) return undefined
  if (daterangeFilter.context === 'exclude') return undefined

  const [fromDate, toDate] = matches.slice(1).map(v => moment.utc(v))
  return moment.duration(toDate.diff(fromDate)).as('days')
}

/**
 * Analyse filters and return the widest inclusive time interval in days.
 * @param filters query filters
 * @return time interval in days or undefined if no valid intervals found
 */
export function getWidestInclusiveTimeInterval(filters: Filter[]): number | undefined {
  const daterangeFilters = filters.filter(({ type }) => type === 'daterange') as DaterangeFilter[]
  const timedeltas = daterangeFilters
    .map(getTimedeltaInDaterangeFilterAsDays)
    .filter((v): v is number => v !== undefined)
    .sort((a, b) => a - b)

  return timedeltas.length > 0 ? timedeltas[0] : undefined
}
