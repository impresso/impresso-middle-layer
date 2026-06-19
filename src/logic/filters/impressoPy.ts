import { Filter, FilterPrecision, FilterType, FilterContext, FilterOperator } from 'impresso-jscommons'

const FilterTypeToPythonArgumentName = {
  string: 'term',
  accessRight: '',
  collection: 'collection_id',
  country: 'country',
  contentLength: 'content_length',
  copyright: 'copyright',
  dataDomain: '',
  daterange: 'date_range',
  entity: 'entity_id',
  hasTextContents: 'with_text_contents',
  isFront: 'front_page',
  issue: 'issue_id',
  language: 'language',
  location: '',
  mention: 'mention',
  newspaper: 'newspaper_id',
  partner: 'partner_id',
  textReuseCluster: 'text_reuse_cluster_id',
  title: 'title',
  topic: 'topic_id',
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
  sourceType: '',
  sourceMedium: '',
  organisation: '',
  embedding: 'embedding',
  imageVisualContent: 'visual_content',
  imageTechnique: 'technique',
  imageCommunicationGoal: 'communication_goal',
  imageContentType: 'content_type',
  contentItemId: 'content_item_id',
  mediaSource: 'media_source_id',
  permissionExplore: 'permission_explore',
  permissionGetTranscript: 'permission_transcript',
  permissionGetImage: 'permission_image',
} satisfies Record<FilterType, string>

const BooleanTypes: FilterType[] = ['hasTextContents', 'isFront']
const NumericRangeTypes: FilterType[] = [
  'textReuseClusterSize',
  'textReuseClusterLexicalOverlap',
  'textReuseClusterDayDelta',
]
const DateRangeTypes: FilterType[] = ['daterange']

const FilterContextToPythonOperatorPrefix: Record<FilterContext, string> = {
  exclude: '~',
  include: '',
}

const FilterOperatorToPythonOperator: Record<FilterOperator, string> = {
  AND: 'AND',
  OR: 'OR',
}

const FilterPrecisionToPythonOperator: Record<FilterPrecision, string> = {
  exact: '',
  fuzzy: 'Fuzzy',
  partial: 'Partial',
  soft: 'Soft',
}

interface PythonValueItem {
  type: 'pureValue' | 'method' | 'operator'
  render: (inner?: string) => string
  child?: PythonValueItem
  totalItems?: number
}

const renderPythonValueItem = (item: PythonValueItem): string => {
  const chain = [item]
  let current: PythonValueItem = item
  while (current.child != null) {
    current = current.child
    chain.push(current)
  }

  const invertedChain = chain.reverse()

  return invertedChain.reduce((acc, item) => item.render(acc), '')
}

const normalizeDateOnly = (value: string): string => {
  const trimmed = value.trim()
  const dateMatch = trimmed.match(/^(\d{4}-\d{2}-\d{2})/)
  return dateMatch?.[1] ?? trimmed
}

const asPythonValue = (filterValue: string | string[], type: FilterType): PythonValueItem => {
  const totalItems = Array.isArray(filterValue) ? filterValue.length : 1

  if (BooleanTypes.includes(type)) {
    const val = filterValue === 'true' ? 'True' : 'False'
    return { type: 'pureValue', render: () => val, totalItems }
  }
  if (NumericRangeTypes.includes(type)) {
    const val = Array.isArray(filterValue) ? filterValue : [filterValue]
    return { type: 'pureValue', render: () => `(${val.map(v => parseFloat(v)).join(', ')})`, totalItems: 1 }
  }
  if (DateRangeTypes.includes(type)) {
    const val = Array.isArray(filterValue) ? filterValue : filterValue.split(' TO ')
    const startDate = normalizeDateOnly(val[0] ?? '')
    const endDate = normalizeDateOnly(val[1] ?? '')
    return {
      type: 'method',
      render: () => `DateRange(${JSON.stringify(startDate)}, ${JSON.stringify(endDate)})`,
      totalItems: 1,
    }
  }
  return { type: 'pureValue', render: () => JSON.stringify(filterValue), totalItems }
}

const withPythonOperator = (pythonValue: PythonValueItem, operator: FilterOperator): PythonValueItem => {
  const pythonOperator = FilterOperatorToPythonOperator[operator]

  if ((pythonValue.totalItems ?? 1) === 1) return pythonValue

  return {
    type: 'method',
    render: inner => `${pythonOperator}(${inner})`,
    child: pythonValue,
  }
}

const withPythonPrecisionOp = (pythonValue: PythonValueItem, precision?: FilterPrecision): PythonValueItem => {
  if (precision == null) return pythonValue
  const precisionValue = FilterPrecisionToPythonOperator[precision]
  if (precisionValue === '') return pythonValue
  return {
    type: 'method',
    render: inner => `${precisionValue}(${inner})`,
    child: pythonValue,
  }
}

const withPythonContextPrefix = (pythonValue: PythonValueItem, context?: FilterContext): PythonValueItem => {
  if (context == null) return pythonValue
  const contextPrefix = FilterContextToPythonOperatorPrefix[context]
  if (contextPrefix === '') return pythonValue
  return {
    type: 'operator',
    render:
      pythonValue?.type === 'pureValue'
        ? inner => `${contextPrefix}AND(${inner})`
        : inner => `${contextPrefix}${inner}`,
    child: pythonValue,
  }
}

const buildPythonArgumentValue = (
  q: string | string[],
  type: FilterType,
  operator: FilterOperator,
  precision?: FilterPrecision,
  context?: FilterContext
): string => {
  const item = withPythonContextPrefix(
    withPythonPrecisionOp(withPythonOperator(asPythonValue(q, type), operator), precision),
    context
  )

  return renderPythonValueItem(item)
}

const DefaultOp = 'AND'
const SpecialBooleanFilters = new Set<FilterType>(BooleanTypes)

const hasDefinedValue = (filter: Filter): boolean => {
  return filter.q !== undefined || SpecialBooleanFilters.has(filter.type)
}

const isSimpleFlattenableFilter = (filter: Filter): boolean => {
  if (filter.q === undefined) return false
  if (!Array.isArray(filter.q)) return true
  return (filter.op ?? DefaultOp) === 'AND' || filter.q.length <= 1
}

const isFlattenableFilterGroup = (filters: Filter[]): boolean => {
  if (filters.length <= 1) return false
  const [first] = filters
  const firstPrecision = first.precision
  const firstContext = first.context

  return filters.every(
    (filter, index) =>
      ((index === 0 && filter.precision === firstPrecision && filter.context === firstContext) ||
        (index > 0 &&
          (filter.precision == null || filter.precision === firstPrecision) &&
          (filter.context == null || filter.context === firstContext))) &&
      isSimpleFlattenableFilter(filter)
  )
}

const mergeFiltersByType = (filters: Filter[]): Filter => {
  const first = filters[0]
  const values = filters.flatMap(filter => (Array.isArray(filter.q) ? filter.q : filter.q != null ? [filter.q] : []))

  const mergedFilter: Filter = {
    type: first.type,
    q: values.length > 1 ? values : values[0],
    op: 'AND',
  }

  if (first.precision != null) mergedFilter.precision = first.precision
  if (first.context != null) mergedFilter.context = first.context

  return mergedFilter
}

const buildExpressionFromFilter = (filter: Filter): string => {
  const argumentValue = BooleanTypes.includes(filter.type) && filter.q == null ? `true` : filter.q
  if (argumentValue === undefined) {
    throw new Error(`Cannot build expression for filter without value: ${filter.type}`)
  }
  return buildPythonArgumentValue(argumentValue, filter.type, filter.op ?? DefaultOp, filter.precision, filter.context)
}

const buildExpressionFromFilterGroup = (filters: Filter[]): string => {
  if (filters.length === 1) return buildExpressionFromFilter(filters[0])

  if (isFlattenableFilterGroup(filters)) {
    return buildExpressionFromFilter(mergeFiltersByType(filters))
  }

  const expressions = filters.map(buildExpressionFromFilter)
  return `AND([${expressions.join(',')}])`
}

/**
 * This function ensures filters of the same type are grouped into one filter
 * with the right AND or OR operator (by default filters in the list
 * are combined with `AND`).
 */
export const aggregateFiltersByType = (filters: Filter[]): Filter[] => {
  if (filters.length <= 1) return filters.filter(hasDefinedValue)

  const groupedByType = new Map<FilterType, Filter[]>()
  for (const filter of filters) {
    if (!hasDefinedValue(filter)) continue
    const group = groupedByType.get(filter.type) ?? []
    group.push(filter)
    groupedByType.set(filter.type, group)
  }

  const result: Filter[] = []
  for (const filtersOfType of groupedByType.values()) {
    if (filtersOfType.length === 1) {
      result.push(filtersOfType[0])
      continue
    }
    if (isFlattenableFilterGroup(filtersOfType)) {
      result.push(mergeFiltersByType(filtersOfType))
      continue
    }
    result.push(...filtersOfType)
  }

  return result
}

const buildPythonArguments = (filters: Filter[]): string[] => {
  const groupedByType = new Map<FilterType, Filter[]>()
  for (const filter of filters) {
    if (!hasDefinedValue(filter)) continue
    const group = groupedByType.get(filter.type) ?? []
    group.push(filter)
    groupedByType.set(filter.type, group)
  }

  const result: string[] = []

  for (const [type, filtersOfType] of groupedByType.entries()) {
    const argumentName = FilterTypeToPythonArgumentName[type]
    if ([undefined, null, ''].includes(argumentName)) continue
    const expression = buildExpressionFromFilterGroup(filtersOfType)
    result.push(`${argumentName}=${expression}`)
  }

  return result
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

export const isResource = (resource: any): resource is Resource => {
  return [
    'search',
    'media_sources',
    'entities',
    'content_items',
    'collections',
    'text_reuse.clusters',
    'text_reuse.passages',
  ].includes(resource)
}

export const isFunctionName = (resource: any): resource is FunctionName => {
  return ['find', 'facet'].includes(resource)
}

export const buildPythonFunctionCall = (resource: Resource, functionName: FunctionName, filters: Filter[]): string => {
  const argumentsList = buildPythonArguments(filters)
  const argumentsString = argumentsList.join(',\n\t')
  const fnString = `impresso.${resource}.${functionName}`
  if (argumentsString.length === 0) return `${fnString}()`
  return `${fnString}(\n\t${argumentsString}\n)`
}
