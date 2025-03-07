import { Filter, FilterPrecision, FilterType, FilterContext, FilterOperator } from 'impresso-jscommons'

const FilterTypeToPythonArgumentName: Record<FilterType, string> = {
  string: 'term',
  accessRight: '',
  collection: 'collection_id',
  country: 'country',
  contentLength: 'content_length',
  copyright: '',
  dataDomain: '',
  daterange: 'date_range',
  entity: 'entity_id',
  hasTextContents: 'with_text_contents',
  isFront: 'front_page',
  issue: '',
  language: 'language',
  location: '',
  mention: 'mention',
  newspaper: 'newspaper_id',
  partner: 'partner_id',
  textReuseCluster: 'text_reuse_cluster_id',
  title: 'title',
  topic: 'topic_id',
  mentionFunction: '',
  month: '',
  year: '',
  nag: '',
  ocrQuality: '',
  page: '',
  person: '',
  regex: '',
  textReuseClusterDayDelta: 'day_delta',
  textReuseClusterLexicalOverlap: 'lexical_overlap',
  textReuseClusterSize: 'cluster_size',
  type: '',
  uid: '',
  wikidataId: 'wikidata_id',
}

const FilterContextToPythonOperatorPrefix: Record<FilterContext, string> = {
  exclude: '~',
  include: '',
}

const FilterOperatorToPythonOperator: Record<FilterOperator, string> = {
  and: 'AND',
  or: 'OR',
}

const FilterPrecisionToPythonOperator: Record<FilterPrecision, string> = {
  exact: '',
  fuzzy: 'Fuzzy',
  partial: 'Partial',
  soft: 'Soft',
}

// interface Filter extends UntypedFilter {
//   type: FilterType
//   context?: FilterContext
//   precision?: FilterPrecision
//   op?: FilterOperator
// }

const asPythonValue = (filterValue: string | string[]): string => {
  return JSON.stringify(filterValue)
}

const withPythonOperator = (pythonValue: string, operator: FilterOperator): string => {
  const pythonOperator = FilterOperatorToPythonOperator[operator]
  const valueWithOperator = `${pythonOperator}(${pythonValue})`
  return valueWithOperator
}

const withPythonPrecisionOp = (pythonValue: string, precision?: FilterPrecision): string => {
  if (precision == null) return pythonValue
  const precisionValue = FilterPrecisionToPythonOperator[precision]
  return `${precisionValue}(${pythonValue})`
}

const withPythonContextPrefix = (pythonValue: string, context?: FilterContext): string => {
  if (context == null) return pythonValue
  const contextPrefix = FilterContextToPythonOperatorPrefix[context]
  return `${contextPrefix}${pythonValue}`
}

const buildPythonArgumentValue = (
  q: string | string[],
  operator: FilterOperator,
  precision?: FilterPrecision,
  context?: FilterContext
): string => {
  return withPythonContextPrefix(
    withPythonPrecisionOp(withPythonOperator(asPythonValue(q), operator), precision),
    context
  )
}

const DefaultOp = 'and'

const buildPythonArgument = (filter: Filter): string | undefined => {
  const argumentName = FilterTypeToPythonArgumentName[filter.type as FilterType]
  if ([undefined, null, ''].includes(argumentName)) return undefined

  const { op, precision, q, context } = filter
  if (q === undefined) return undefined

  const value = buildPythonArgumentValue(q, op ?? DefaultOp, precision, context)

  return `${argumentName}=${value}`
}

const buildPythonArguments = (filters: Filter[]): string[] => {
  return filters.map(filter => buildPythonArgument(filter)).filter(Boolean) as string[]
}

type Resource =
  | 'search'
  | 'media_sources'
  | 'entities'
  | 'content_items'
  | 'collections'
  | 'text_reuse.clusters'
  | 'text_reuse.passages'
type FunctionName = 'find' | 'facet'

export const buildPythonFunctionCall = (resource: Resource, functionName: FunctionName, filters: Filter[]): string => {
  const argumentsList = buildPythonArguments(filters)
  const argumentsString = argumentsList.join(', ')
  return `${resource}.${functionName}(${argumentsString})`
}
