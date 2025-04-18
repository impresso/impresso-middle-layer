import { readFileSync } from 'fs'
import YAML from 'yaml'
import { Filter, FilterPrecision } from '../../models'
import { SolrFiltersConfiguration } from '../../models/generated/common'
import { SolrNamespace } from '../../solr'
import { InvalidArgumentError } from '../error'
import capitalisedValueFilterBuilder from './filterBuilders/capitalisedValue'
import { valueBuilder, idValueBuilder, escapeIdValue, unescapeIdValue } from './filterBuilders/value'

export { escapeIdValue, unescapeIdValue }

const filtersConfig: SolrFiltersConfiguration = YAML.parse(readFileSync(`${__dirname}/solrFilters.yml`).toString())

export const escapeValue = (value: string) => value.replace(/[()\\+&|!{}[\]?:;,^]/g, (d: string) => `\\${d}`)

const RangeValueRegex = /^\s*\d+\s+TO\s+\d+\s*$/

const reduceNumericRangeFilters = (filters: Filter[], field: string) => {
  const items = filters.reduce((sq, filter) => {
    let q // q is in the form array ['1 TO 10', '20 TO 30'] (OR condition)
    // or simple string '1 TO X';
    if (Array.isArray(filter.q)) {
      if (filter.q.length !== 2 || !filter.q.every(v => Number.isFinite(parseInt(v, 10)))) {
        throw new InvalidArgumentError(`"numericRange" filter rule: unknown values encountered in "q": ${filter.q}`)
      }
      q = `${field}:[${filter.q[0]} TO ${filter.q[1]}]`
    } else if (filter.q != null) {
      if (!filter.q.match(RangeValueRegex)) {
        throw new InvalidArgumentError(`"numericRange" filter rule: unknown value encountered in "q": ${filter.q}`)
      }
      q = `${field}:[${filter.q}]`
    } else {
      q = `${field}:*`
    }

    if (filter.context === 'exclude') {
      q = sq.length > 0 ? `NOT (${q})` : `*:* AND NOT (${q})`
    }
    sq.push(q)
    return sq
  }, [] as string[])

  return items.join(' AND ')
}

const SolrSupportedLanguages = ['en', 'fr', 'de']

const fullyEscapeValue = (value: string) => escapeValue(value).replace(/"/g, d => `\\${d}`)

/**
 * Convert filter to a Solr request.
 * @param {string} value filter value
 * @param {string[]} solrFields Solr fields to apply the value to.
 * @param {import('../../models').FilterPrecision} precision filter precision.
 */
const getStringQueryWithFields = (value: string | null, solrFields: string[], precision?: FilterPrecision) => {
  let q
  if (value != null) {
    q = value.trim()
    const hasMultipleWords = q.split(/\s/).length > 1
    const isExact = q.match(/^"(.*)"(~[12345])?$/)
    const isFuzzy = q.match(/^(.*)~([12345])$/)
    if (isExact && isFuzzy) {
      q = `"${fullyEscapeValue(isExact[1])}"${isExact[2]}`
    } else if (isExact) {
      q = `"${fullyEscapeValue(isExact[1])}"`
    } else if (isFuzzy) {
      q = `"${fullyEscapeValue(isFuzzy[1])}"`
    } else {
      // use filter properties if set
      q = fullyEscapeValue(q)
      if (precision === 'soft') {
        q = `(${q.split(/\s+/g).join(' OR ')})`
      } else if (precision === 'fuzzy') {
        // "richard chase"~1
        q = `"${q.split(/\s+/g).join(' ')}"~1`
      } else if (precision === 'exact') {
        q = `"${q}"`
      } else if (hasMultipleWords) {
        // text:"Richard Chase"
        q = q.replace(/"/g, ' ')
        q = `"${q.split(/\s+/g).join(' ')}"`
        q = `(${q.split(/\s+/g).join(' ')})`
      }
    }
  } else {
    q = '*'
  }

  const items = solrFields.map(f => `${f}:${q}`)
  const statement = items.join(' OR ')
  return items.length > 1 ? `(${statement})` : statement
}

/**
 * String type filter handler
 * @param {import('../../models').Filter[]} filters
 * @param {string | string[] | object} field
 * @return {string} solr query
 */
const reduceStringFiltersToSolr = (filters: Filter[], field: string | string[] | { prefix?: string }) => {
  const languages = SolrSupportedLanguages
  const items = filters.map(({ q, op = 'OR', precision, context }, index) => {
    let fields = []

    if (typeof field === 'string') fields = [field]
    else if (Array.isArray(field)) fields = field
    else if (field.prefix != null) fields = languages.map(lang => `${field.prefix}${lang}`)
    else throw new InvalidArgumentError(`Unknown type of Solr field: ${JSON.stringify(field)}`)

    let queryList: (string | null)[] = [null]

    if (Array.isArray(q) && q.length > 0) {
      queryList = q.filter(v => v != null && v !== '')
      if (queryList.length === 0) queryList = [null]
    } else if (typeof q === 'string' && q != null && q !== '') queryList = [q]

    let transformedQuery = queryList
      .map(value => getStringQueryWithFields(value, fields, precision))
      // @ts-ignore
      .flat()
      .join(` ${op} `)

    if (context === 'exclude') {
      transformedQuery = index > 0 ? `NOT (${transformedQuery})` : `*:* AND NOT (${transformedQuery})`
    }

    return queryList.length > 1 ? `(${transformedQuery})` : transformedQuery
  })

  // @ts-ignore
  return items.flat().join(' AND ')
}

const DateRangeValueRegex = /^\s*[TZ:\d-]+\s+TO\s+[TZ:\d-]+\s*$/
const DateOnlyRegex = /^\s*(\d{4}-\d{2}-\d{2})\s*$/
const YearMonthRegex = /^\s*(\d{4}-\d{2})\s*$/
const YearOnlyRegex = /^\s*(\d{4})\s*$/

/**
 * Normalise date value to a Solr date format:
 * * YYYY -> YYYY-01-01T00:00:00Z
 * * YYYY-MM -> YYYY-MM-01T00:00:00Z
 * * YYYY-MM-DD -> YYYY-MM-DDT00:00:00Z
 * * YYYY-MM-DDTHH:MM:SSZ -> YYYY-MM-DDTHH:MM:SSZ
 */
const normaliseDate = (value: string, timeBound: 'start' | 'end' = 'start'): string => {
  const timeComponent = timeBound === 'start' ? 'T00:00:00Z' : 'T23:59:59Z'
  const yearMatch = value.match(YearOnlyRegex)
  if (yearMatch) {
    return `${yearMatch[1]}-01-01${timeComponent}`
  }
  const yearMonthMatch = value.match(YearMonthRegex)
  if (yearMonthMatch) {
    return `${yearMonthMatch[1]}-01${timeComponent}`
  }
  const dateMatch = value.match(DateOnlyRegex)
  if (dateMatch) {
    return `${dateMatch[1]}${timeComponent}`
  }
  // Assume it's already in the correct full format or handle other cases if needed
  return value
}

// Helper to get the last day of the month in YYYY-MM-DD format
const getLastDayOfMonth = (year: number, month: number): string => {
  const date = new Date(Date.UTC(year, month, 0)) // Day 0 gives the last day of the previous month
  return date.toISOString().split('T')[0]
}

const reduceDaterangeFiltersToSolr = (filters: Filter[], field: string, rule: string) => {
  const items = filters.reduce((sq, filter) => {
    // Allow q to be string | string[] | null
    const query: string | string[] | undefined =
      Array.isArray(filter.q) && filter.q.length === 1 ? filter.q[0] : filter.q
    const op = filter.op || 'OR' // Default OR, though less relevant when joining filters with AND

    let q
    if (Array.isArray(query)) {
      // Case: q = ["YYYY-MM-DD", "YYYY-MM-DD"]
      if (query.length !== 2) {
        throw new InvalidArgumentError(`"${rule}" filter rule: array "q" must have exactly 2 elements: ${filter.q}`)
      }
      const start = normaliseDate(query[0], 'start')
      const end = normaliseDate(query[1], 'end')
      q = `${field}:[${start} TO ${end}]`
    } else if (typeof query === 'string' && query !== null) {
      if (!DateRangeValueRegex.test(query)) {
        throw new InvalidArgumentError(`"${rule}" filter rule: unknown value encountered in "q": ${filter.q}`)
      }

      // Case: q is a single string value
      const trimmedQuery = query.trim()
      const rangeMatch = trimmedQuery.match(DateRangeValueRegex)
      const yearMatch = trimmedQuery.match(YearOnlyRegex)
      const yearMonthMatch = trimmedQuery.match(YearMonthRegex)
      const dateMatch = trimmedQuery.match(DateOnlyRegex)

      if (rangeMatch) {
        // Case: q = "YYYY-MM-DD TO YYYY-MM-DD" (potentially with times)
        const parts = trimmedQuery.split(/\s+TO\s+/)
        const start = normaliseDate(parts[0], 'start')
        const end = normaliseDate(parts[1], 'end')
        const endInclusive = end.endsWith('T00:00:00Z') ? end.replace('T00:00:00Z', 'T23:59:59Z') : end
        q = `${field}:[${start} TO ${endInclusive}]`
      } else if (yearMatch) {
        // Case: q = "YYYY" -> range for the whole year
        const year = yearMatch[1]
        q = `${field}:[${year}-01-01T00:00:00Z TO ${year}-12-31T23:59:59Z]`
      } else if (yearMonthMatch) {
        // Case: q = "YYYY-MM" -> range for the whole month
        const [yearStr, monthStr] = yearMonthMatch[1].split('-')
        const year = parseInt(yearStr, 10)
        const month = parseInt(monthStr, 10)
        const lastDay = getLastDayOfMonth(year, month) // month is 1-based for Date constructor trick
        q = `${field}:[${yearStr}-${monthStr}-01T00:00:00Z TO ${lastDay}T23:59:59Z]`
      } else if (dateMatch) {
        // Case: q = "YYYY-MM-DD" -> range for the whole day
        const date = dateMatch[1]
        q = `${field}:[${date}T00:00:00Z TO ${date}T23:59:59Z]`
      } else {
        // If it doesn't match known patterns, treat as potentially already valid Solr range or throw error
        // Using as is for now:
        // throw new InvalidArgumentError(`"${rule}" filter rule: unknown date/range format encountered in "q": ${filter.q}`)
        q = `${field}:[${trimmedQuery}]` // Fallback, might be incorrect
      }
    } else {
      // Case: q is null or empty array -> match all
      q = `${field}:*`
    }

    if (filter.context === 'exclude') {
      q = sq.length > 0 ? `NOT (${q})` : `*:* AND NOT (${q})`
    }
    sq.push(q)
    return sq
  }, [] as string[])

  // Join multiple filter conditions with AND
  return items.join(' AND ')
}

const reduceRegexFiltersToSolr = (filters: Filter[], field: string | string[] | { prefix?: string }) => {
  let fields = []
  if (typeof field === 'string') fields = [field]
  else if (Array.isArray(field)) fields = field
  else if (field.prefix != null) fields = SolrSupportedLanguages.map(lang => `${field.prefix}${lang}`)
  else throw new InvalidArgumentError(`Unknown type of Solr field: ${JSON.stringify(field)}`)

  return filters
    .reduce((reduced, { q, op = 'OR' }) => {
      // cut regexp at any . not preceded by an escape sign.
      let queryString
      if (Array.isArray(q)) {
        if (q.length > 1) {
          throw new InvalidArgumentError(
            `"regex" filter rule supports only single element arrays in "q": ${JSON.stringify(q)}`
          )
        } else if (q.length === 0) {
          queryString = '/.*/'
        } else {
          queryString = q[0].trim()
        }
      } else if (q != null) {
        queryString = q.trim()
      } else {
        queryString = '/.*/'
      }

      const queryValues = queryString
        // get rid of first / and last /
        .replace(/^\/|\/$/g, '')
        // split on point or spaces
        .split(/\\?\.[*+]/)
        // filterout empty stuff
        .filter(d => d.length)

      const query = (queryValues.length > 0 ? queryValues : ['.*'])
        // rebuild;
        .map(d => fields.map(f => `${f}:/${d}/`).join(` ${op} `))
      return reduced.concat(query.map(v => (fields.length > 1 ? `(${v})` : v)))
    }, [] as string[])
    .join(' AND ')
}

const minLengthOneHandler = (filters: Filter[], field: string, filterRule: string) => {
  if (typeof field !== 'string') throw new InvalidArgumentError(`"${filterRule}" supports only "string" fields`)
  return `${field}:[1 TO *]`
}

const booleanHandler = (filters: Filter[], field: string, filterRule: string) => {
  if (typeof field !== 'string') throw new InvalidArgumentError(`"${filterRule}" supports only "string" fields`)
  return `${field}:1`
}

const textAsOpenEndedSearchString = (text: string, field: string) => {
  const parts = text.split(' ').filter(v => v !== '')
  const statement = parts
    .map(part => part.replace(/"/g, '\\"').replace(/\(/g, '').replace(/\)/g, ''))
    .map((part, index, arr) => {
      const suffix = index === arr.length - 1 ? '*' : ''
      return `${field}:${part}${suffix}`
    })
    .join(' AND ')
  return parts.length > 1 ? `(${statement})` : statement
}

const reduceOpenEndedStringValue = (filters: Filter[], field: string) => {
  const outerStatement = filters
    .map(filter => {
      const strings = Array.isArray(filter.q) ? filter.q : [filter.q!]
      const statement = strings.map(v => textAsOpenEndedSearchString(v, field)).join(` ${filter.op || 'OR'} `)
      return strings.length > 1 ? `(${statement})` : statement
    })
    .join(' AND ')
  return filters.length > 1 ? `(${outerStatement})` : outerStatement
}

const noopHandler = () => '*:*'

const FiltersHandlers = Object.freeze({
  minLengthOne: minLengthOneHandler,
  numericRange: reduceNumericRangeFilters,
  boolean: booleanHandler,
  string: reduceStringFiltersToSolr,
  dateRange: reduceDaterangeFiltersToSolr,
  value: valueBuilder,
  idValue: idValueBuilder,
  regex: reduceRegexFiltersToSolr,
  capitalisedValue: capitalisedValueFilterBuilder,
  openEndedString: reduceOpenEndedStringValue,
  noop: noopHandler,
})

/**
 * Convert a set of filters of the same type to a SOLR query string.
 * Types are defined in `solrFilters.yml` for the corresponding namespace
 *
 * @param {import('../../models').Filter[]} filters list of filters of the same type.
 * @param {string} solrNamespace namespace (index) this filter type belongs to.
 *
 * @returns {string} a SOLR query string that can be wrapped into a `filter()` statement.
 */
export const filtersToSolr = (filters: Filter[], solrNamespace: SolrNamespace) => {
  if (filters.length < 1) throw new InvalidArgumentError('At least one filter must be provided')
  const types = [...new Set(filters.map(({ type }) => type))]
  if (types.length > 1) throw new InvalidArgumentError(`Filters must be of the same type. Found types: "${types}"`)
  const type = types[0]

  const filtersRules = filtersConfig.indexes?.[solrNamespace as string]
    ? filtersConfig.indexes[solrNamespace as string].filters
    : {}
  const filterRules = filtersRules[type]
  if (filterRules == null) {
    throw new InvalidArgumentError(`Unknown filter type "${type}" in namespace "${solrNamespace as string}"`)
  }

  const handler = FiltersHandlers[filterRules.rule as keyof typeof FiltersHandlers]
  if (handler == null) throw new InvalidArgumentError(`Could not find handler for rule ${filterRules.rule}`)

  return handler(filters, filterRules.field as any, filterRules.rule)
}
