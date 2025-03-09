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

const BooleanTypes: FilterType[] = ['hasTextContents', 'isFront']
const NumericRangeTypes: FilterType[] = ['textReuseClusterSize', 'textReuseClusterLexicalOverlap']
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

const asPythonValue = (filterValue: string | string[], type: FilterType): PythonValueItem => {
  const totalItems = Array.isArray(filterValue) ? filterValue.length : 1

  if (BooleanTypes.includes(type)) {
    const val = filterValue === 'true' ? 'True' : 'False'
    return { type: 'pureValue', render: () => val, totalItems }
  }
  if (NumericRangeTypes.includes(type)) {
    const val = Array.isArray(filterValue) ? filterValue : [filterValue]
    return { type: 'pureValue', render: () => JSON.stringify(val.map(v => parseFloat(v))), totalItems }
  }
  if (DateRangeTypes.includes(type)) {
    const val = Array.isArray(filterValue) ? filterValue : filterValue.split(' TO ')
    return {
      type: 'method',
      render: () => `DateRange(${JSON.stringify(val[0])}, ${JSON.stringify(val[1])})`,
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
    render: inner => `${operator}(${inner})`,
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

const buildPythonArgument = (filter: Filter): string | undefined => {
  const argumentName = FilterTypeToPythonArgumentName[filter.type]
  if ([undefined, null, ''].includes(argumentName)) return undefined

  const { op, precision, q, context } = filter

  const argumentValue = BooleanTypes.includes(filter.type) && q == null ? `true` : q
  if (argumentValue === undefined) return undefined

  const value = buildPythonArgumentValue(argumentValue, filter.type, op ?? DefaultOp, precision, context)

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
