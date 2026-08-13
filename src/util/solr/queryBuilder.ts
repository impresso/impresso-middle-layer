import type {
  FeaturesConfig,
  IndexDefinition,
  SolrFiltersConfiguration,
  SolrServerNamespaceConfiguration,
} from '@/models/generated/app/configuration.js'
import type { Filter } from '@/models/index.js'
import { SupportedLanguageCodes } from '@/models/solr.js'
import { SolrNamespace, SolrNamespaces } from '@/solr.js'
import { InvalidArgumentError } from '@/util/error.js'
import { escapeIdValue, unescapeIdValue } from '@/util/solr/filterBuilders/value.js'
import { readFileSync } from 'fs'
import { dirname } from 'path'
import { fileURLToPath } from 'url'
import YAML from 'yaml'

export type SolrQueryNode =
  | string
  | { bool: SolrBoolNode }
  | { knn: { f: string; topK: number; query: string; preFilter?: string } }
  | {
      join: {
        from: string
        to: string
        fromIndex?: string
        method?: 'index' | 'crossCollection'
        checkRouterField?: boolean
        query: string
      }
    }
  | Record<string, Record<string, unknown>>

export interface SolrBoolNode {
  must?: SolrQueryNode[]
  must_not?: SolrQueryNode[]
  should?: SolrQueryNode[]
  minimum_should_match?: number | string
}

export interface SolrJsonQueryBody {
  query: SolrQueryNode
  filter: SolrQueryNode[]
  params: Record<string, string | number | boolean>
}

export interface BuildSolrQueryOptions {
  orderBy?: string
  extractVariables?: boolean | { minLength: number }
}

type Field = string | string[] | { prefix: string }
type FieldShape = 'string' | 'string[]' | 'prefix'
type Rule = { accepts: FieldShape[]; handlesContext?: boolean; exclusive?: 'knn' }
type Group = {
  type: string
  context: 'include' | 'exclude'
  definition: { field: Field; rule: string; scoring?: boolean }
  filters: Filter[]
}

// ---------------------------------------------------------------------------
// Named regular expressions
// ---------------------------------------------------------------------------

/** Characters that have special meaning in Solr query syntax and must be escaped. */
const SOLR_SPECIAL_CHARACTERS = /[()\\+&|!{}[\]?:;,^]/g

/** A four-digit year, e.g. "1918". */
const YEAR_ONLY_PATTERN = /^\d{4}$/

/** A year and month, e.g. "1918-05". */
const YEAR_MONTH_PATTERN = /^\d{4}-\d{2}$/

/** A full ISO date, e.g. "1918-05-17". */
const FULL_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

/** Separator between the two bounds of a date/number range, e.g. "1900 TO 1910". */
const RANGE_SEPARATOR_PATTERN = /\s+TO\s+/

/** A complete numeric range string, e.g. " 10 TO 20 ". */
const NUMERIC_RANGE_PATTERN = /^\s*\d+\s+TO\s+\d+\s*$/

/** A value already wrapped in double quotes, optionally with a fuzzy suffix, e.g. `"foo bar"~2`. */
const QUOTED_PHRASE_PATTERN = /^"(.*)"(~[12345])?$/

/** Any whitespace character. */
const WHITESPACE_PATTERN = /\s/

/** One or more whitespace characters (used for splitting into terms). */
const WHITESPACE_RUN_PATTERN = /\s+/

/** Leading or trailing slash delimiters of a regex literal, e.g. the slashes around `foo.*`. */
const REGEX_DELIMITER_PATTERN = /^\/|\/$/g

/** A "match anything" wildcard fragment (`.*` / `.+`), optionally escaped, used to split regexes into fragments. */
const REGEX_WILDCARD_FRAGMENT_PATTERN = /\\?\.[*+]/

// ---------------------------------------------------------------------------
// Filter definition registry (loaded from YAML, validated at module load time)
// ---------------------------------------------------------------------------

const configPath = `${dirname(fileURLToPath(import.meta.url))}/solrFilters.yml`
const registry = (YAML.parse(readFileSync(configPath, 'utf8')) as SolrFiltersConfiguration).indexes ?? {}

const ruleRegistry: Record<string, Rule> = {
  minLengthOne: { accepts: ['string'] },
  boolean: { accepts: ['string'] },
  noop: { accepts: ['string', 'string[]', 'prefix'] },
  numericRange: { accepts: ['string'] },
  dateRange: { accepts: ['string'] },
  value: { accepts: ['string', 'string[]'] },
  idValue: { accepts: ['string', 'string[]'] },
  capitalisedValue: { accepts: ['string'] },
  imageTypeValueOrLabel: { accepts: ['string'] },
  string: { accepts: ['string', 'string[]', 'prefix'] },
  openEndedString: { accepts: ['string'] },
  regex: { accepts: ['string', 'string[]', 'prefix'] },
  joinCollection: { accepts: ['string'], handlesContext: true },
  embeddingKnnSimilarity: { accepts: ['string[]'], exclusive: 'knn' },
}

/** Determine the shape of a configured field: a single field name, a list of field names, or a language prefix. */
function shapeOf(field: Field): FieldShape {
  if (typeof field === 'string') return 'string'
  if (Array.isArray(field)) return 'string[]'
  return 'prefix'
}

/** Fail fast at startup if any filter definition references an unknown rule or an incompatible field shape. */
function validateFilterDefinitions(): void {
  for (const [namespace, index] of Object.entries(registry)) {
    for (const [type, definition] of Object.entries(index.filters)) {
      const rule = ruleRegistry[definition.rule]

      if (!rule) {
        throw new InvalidArgumentError(
          `Unknown rule "${definition.rule}" for filter type "${type}" in namespace "${namespace}"`
        )
      }

      const shape = shapeOf(definition.field as Field)
      if (!rule.accepts.includes(shape)) {
        throw new InvalidArgumentError(
          `Rule "${definition.rule}" does not accept field shape ${shape} (filter type "${type}", namespace "${namespace}")`
        )
      }
    }
  }
}

validateFilterDefinitions()

// ---------------------------------------------------------------------------
// Query node combinators
// ---------------------------------------------------------------------------

/** Combine nodes with OR. A single node is returned as-is to avoid unnecessary nesting. */
function orNode(nodes: SolrQueryNode[]): SolrQueryNode {
  if (nodes.length === 1) return nodes[0]
  return { bool: { should: nodes, minimum_should_match: 1 } }
}

/** Combine nodes with AND. A single node is returned as-is to avoid unnecessary nesting. */
function andNode(nodes: SolrQueryNode[]): SolrQueryNode {
  if (nodes.length === 1) return nodes[0]
  return { bool: { must: nodes } }
}

// ---------------------------------------------------------------------------
// Field and value helpers
// ---------------------------------------------------------------------------

/**
 * Resolve a configured field to the concrete Solr field names to query.
 * A `prefix` field is expanded to one field per supported language,
 * plus the prefix without its trailing separator (the language-agnostic field).
 */
function fieldsFor(field: Field): string[] {
  if (typeof field === 'string') return [field]
  if (Array.isArray(field)) return field

  const languageFields = SupportedLanguageCodes.map(language => `${field.prefix}${language}`)
  const languageAgnosticField = field.prefix.slice(0, -1)
  return languageFields.concat(languageAgnosticField)
}

/** Escape characters that have special meaning in Solr query syntax. */
function escapeValue(value: string): string {
  return value.replace(SOLR_SPECIAL_CHARACTERS, character => `\\${character}`)
}

/**
 * Normalize the filter's `q` property into a list of leaf values.
 * Missing or empty values become the wildcard `*` (match anything).
 */
function leafValues(filter: Filter): string[] {
  if (Array.isArray(filter.q)) {
    return filter.q.length ? filter.q : ['*']
  }
  if (filter.q && filter.q.trim()) {
    return [filter.q]
  }
  return ['*']
}

/**
 * Build a node matching any of the filter's values in any of the resolved fields.
 * Values are combined with the filter's operator (`AND` or `OR`);
 * for each value, matches across multiple fields are combined with OR.
 */
function valuesNode(filter: Filter, field: Field, transform = escapeValue): SolrQueryNode {
  const values = leafValues(filter).map(value => {
    const fieldNodes = fieldsFor(field).map(solrField => {
      const rendered = value === '*' ? '*' : transform(value)
      return `${solrField}:${rendered}`
    })
    return orNode(fieldNodes)
  })
  return filter.op === 'AND' ? andNode(values) : orNode(values)
}

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

/**
 * Expand a partial date to a full ISO timestamp.
 * A year becomes January 1st, a year-month becomes the 1st of the month.
 * The `bound` selects the start (00:00:00) or end (23:59:59) of that day.
 * Anything else (already a full timestamp) is returned unchanged.
 */
function expandPartialDate(value: string, bound: 'start' | 'end'): string {
  const time = bound === 'start' ? '00:00:00' : '23:59:59'

  if (YEAR_ONLY_PATTERN.test(value)) return `${value}-01-01T${time}Z`
  if (YEAR_MONTH_PATTERN.test(value)) return `${value}-01T${time}Z`
  if (FULL_DATE_PATTERN.test(value)) return `${value}T${time}Z`
  return value
}

/** Build a single date range node for one leaf value (either a range "A TO B" or a single date). */
function dateLeaf(value: string, field: string): string {
  const parts = value.trim().split(RANGE_SEPARATOR_PATTERN)

  if (parts.length === 2) {
    const start = expandPartialDate(parts[0], 'start')
    // An explicit "start of day" end bound really means "the whole day".
    const end = expandPartialDate(parts[1], 'end').replace('T00:00:00Z', 'T23:59:59Z')
    return `${field}:[${start} TO ${end}]`
  }

  if (YEAR_ONLY_PATTERN.test(value)) {
    return `${field}:[${value}-01-01T00:00:00Z TO ${value}-12-31T23:59:59Z]`
  }

  return `${field}:[${value}]`
}

// ---------------------------------------------------------------------------
// Embedding vector helper
// ---------------------------------------------------------------------------

/** Decode a base64-encoded Float32 vector into a JSON array literal for the Solr KNN query parser. */
function vector(base64: string): string {
  const buffer = Buffer.from(base64, 'base64')
  const floats = new Float32Array(buffer.buffer, buffer.byteOffset, buffer.length / 4)
  return JSON.stringify(Array.from(floats))
}

// ---------------------------------------------------------------------------
// Variable extraction (long string leaves are moved into `params`)
// ---------------------------------------------------------------------------

/**
 * Replace string leaves longer than `minLength` with `$vN` parameter references,
 * storing the original values in `params`. Keeps query strings short enough
 * for Solr's parser and enables query-level caching.
 */
function extractLongLeaves(
  node: SolrQueryNode,
  params: SolrJsonQueryBody['params'],
  minLength: number,
  sequence: { value: number }
): SolrQueryNode {
  if (typeof node === 'string') {
    if (node.length <= minLength) return node

    const key = `v${sequence.value++}`
    params[key] = node
    return `$${key}`
  }

  if (!('bool' in node)) return node

  const bool = (node as { bool: SolrBoolNode }).bool
  const recurse = (child: SolrQueryNode) => extractLongLeaves(child, params, minLength, sequence)

  return {
    bool: {
      ...(bool.must ? { must: bool.must.map(recurse) } : {}),
      ...(bool.must_not ? { must_not: bool.must_not.map(recurse) } : {}),
      ...(bool.should ? { should: bool.should.map(recurse) } : {}),
      ...(bool.minimum_should_match != null ? { minimum_should_match: bool.minimum_should_match } : {}),
    },
  }
}

// ---------------------------------------------------------------------------
// Rule handlers: one builder per non-trivial filter rule
// ---------------------------------------------------------------------------

function buildNumericRangeNode(filter: Filter, field: Field): SolrQueryNode {
  const fieldName = field as string

  if (Array.isArray(filter.q)) {
    const isValidPair = filter.q.length === 2 && filter.q.every(value => Number.isFinite(parseInt(value, 10)))
    if (!isValidPair) {
      throw new InvalidArgumentError(`"numericRange" filter rule: unknown values encountered in "q": ${filter.q}`)
    }
    return `${fieldName}:[${filter.q[0]} TO ${filter.q[1]}]`
  }

  if (filter.q != null) {
    if (!NUMERIC_RANGE_PATTERN.test(filter.q)) {
      throw new InvalidArgumentError(`"numericRange" filter rule: unknown value encountered in "q": ${filter.q}`)
    }
    return `${fieldName}:[${filter.q}]`
  }

  return `${fieldName}:*`
}

function buildDateRangeNode(filter: Filter, field: Field): SolrQueryNode {
  const fieldName = field as string

  if (Array.isArray(filter.q)) {
    if (!filter.q.length) {
      throw new InvalidArgumentError(`"dateRange" filter rule: array "q" must have exactly 2 elements: ${filter.q}`)
    }

    // Two plain dates form a single [start TO end] range.
    const isSimpleRange =
      filter.q.length === 2 && !filter.q[0].includes(' TO ') && !filter.q[1].includes(' TO ')
    if (isSimpleRange) {
      const start = expandPartialDate(filter.q[0], 'start')
      const end = expandPartialDate(filter.q[1], 'end')
      return `${fieldName}:[${start} TO ${end}]`
    }

    // Otherwise each element is its own range/date leaf, combined with OR.
    return orNode(filter.q.map(value => dateLeaf(value, fieldName)))
  }

  if (filter.q) return dateLeaf(filter.q, fieldName)
  return `${fieldName}:*`
}

function buildStringNode(filter: Filter, field: Field): SolrQueryNode {
  const values = Array.isArray(filter.q) ? filter.q.filter(Boolean) : filter.q ? [filter.q] : ['*']

  const format = (value: string): string => {
    if (value === '*') return value

    const trimmed = value.trim()

    // Already-quoted phrases keep their quoting (and optional fuzzy suffix);
    // embedded quotes are escaped.
    const quoted = trimmed.match(QUOTED_PHRASE_PATTERN)
    if (quoted) {
      const phrase = quoted[1].replace(/"/g, '\\"')
      const fuzzySuffix = quoted[2] ?? ''
      return `"${phrase}"${fuzzySuffix}`
    }

    const escaped = escapeValue(trimmed).replace(/"/g, '\\"')

    if (filter.precision === 'soft') {
      // Any term may match.
      const terms = escaped.split(WHITESPACE_RUN_PATTERN)
      return `(${terms.join(' OR ')})`
    }
    if (filter.precision === 'fuzzy') {
      // Phrase with edit distance 1.
      const terms = escaped.split(WHITESPACE_RUN_PATTERN)
      return `"${terms.join(' ')}"~1`
    }
    if (filter.precision === 'exact' || WHITESPACE_PATTERN.test(trimmed)) {
      return `"${escaped}"`
    }
    return escaped
  }

  const nodes = values.map(value => {
    const fieldNodes = fieldsFor(field).map(solrField => `${solrField}:${format(value)}`)
    return orNode(fieldNodes)
  })
  return filter.op === 'AND' ? andNode(nodes) : orNode(nodes)
}

function buildOpenEndedStringNode(filter: Filter, field: Field): SolrQueryNode {
  const values = leafValues(filter).map(value => {
    // Split into terms; the last term gets a trailing wildcard
    // to support "search as you type" prefix matching.
    const parts = value.split(' ').filter(Boolean)

    const termNodes = parts.map((part, index) => {
      const isLast = index === parts.length - 1
      const sanitized = part.replace(/"/g, '\\"').replace(/[()]/g, '')
      return `${field as string}:${sanitized}${isLast ? '*' : ''}`
    })

    return andNode(termNodes)
  })
  return filter.op === 'AND' ? andNode(values) : orNode(values)
}

function buildRegexNode(filter: Filter, field: Field): SolrQueryNode {
  if (Array.isArray(filter.q) && filter.q.length > 1) {
    throw new InvalidArgumentError(
      `"regex" filter rule supports only single element arrays in "q": ${JSON.stringify(filter.q)}`
    )
  }

  const raw = (Array.isArray(filter.q) ? filter.q[0] : filter.q) ?? '/.*/'

  // Strip the surrounding slashes, then split the pattern on "match anything"
  // wildcards: Solr regex queries cannot contain `.*`/`.+`, so each remaining
  // fragment becomes its own regex clause, all of which must match.
  const fragments = raw
    .replace(REGEX_DELIMITER_PATTERN, '')
    .split(REGEX_WILDCARD_FRAGMENT_PATTERN)
    .filter(Boolean)

  const fragmentNodes = (fragments.length ? fragments : ['.*']).map(fragment => {
    const fieldNodes = fieldsFor(field).map(solrField => `${solrField}:/${fragment}/`)
    return orNode(fieldNodes)
  })
  return andNode(fragmentNodes)
}

function buildJoinCollectionNode(
  filter: Filter,
  field: Field,
  configuration: SolrServerNamespaceConfiguration[],
  features: FeaturesConfig
): SolrQueryNode {
  const namespace = configuration.find(item => item.namespaceId === SolrNamespaces.CollectionItems)
  if (!namespace) {
    throw new InvalidArgumentError(
      `Could not find Solr namespace configuration for "${SolrNamespaces.CollectionItems}" required for "joinCollection" filter`
    )
  }

  const ids = leafValues(filter).filter(value => value !== '*')
  if (!ids.length) {
    throw new InvalidArgumentError('At least one collection ID must be provided for "joinCollection" filter')
  }

  const usesNewIndex = features.collectionsIndexVersion === 'new'

  // Deliberately preserved legacy behaviour: excludes are negated inside
  // the join subquery, rather than becoming an outer must_not clause.
  const subQuery = ids
    .map(id => `${filter.context === 'exclude' ? 'NOT ' : ''}col_id_s:*_${id}`)
    .join(` ${filter.op ?? 'OR'} `)

  return {
    join: {
      from: 'ci_id_s',
      to: field as string,
      fromIndex: namespace.index,
      method: usesNewIndex ? 'index' : 'crossCollection',
      ...(usesNewIndex ? { checkRouterField: false } : {}),
      query: subQuery,
    },
  }
}

function buildEmbeddingKnnSimilarityNode(filter: Filter, field: Field): SolrQueryNode {
  const source = Array.isArray(filter.q) ? filter.q[0] : filter.q
  if (!source?.includes(':')) {
    throw new InvalidArgumentError(
      `"embeddingKnnSimilarity" filter rule requires "q" to be a string in the format "model:base64_encoded_vector", e.g. "openclip-768:BASE64_ENCODED_VECTOR". Received: ${JSON.stringify(filter.q)}`
    )
  }

  const [model, encoded, topK] = source.split(':')

  // The field list maps model names to their vector fields: ["model:field", ...].
  const models = Object.fromEntries((field as string[]).map(entry => entry.split(':')))
  if (!models[model]) {
    throw new InvalidArgumentError(
      `"embeddingKnnSimilarity" filter rule: unknown model "${model}". Supported models: ${Object.keys(models).join(', ')}`
    )
  }

  const parsedTopK = parseInt(topK, 10)

  return {
    knn: {
      f: models[model],
      topK: Number.isFinite(parsedTopK) ? parsedTopK : 10,
      query: vector(encoded),
    },
  }
}

// ---------------------------------------------------------------------------
// Filter -> query node dispatch
// ---------------------------------------------------------------------------

function buildNode(
  filter: Filter,
  group: Group,
  configuration: SolrServerNamespaceConfiguration[],
  features: FeaturesConfig
): SolrQueryNode {
  const { field, rule } = group.definition

  switch (rule) {
    case 'minLengthOne':
      // Match documents where the field has at least one character.
      return `${field as string}:[1 TO *]`

    case 'boolean':
      return `${field as string}:1`

    case 'noop':
      return '*:*'

    case 'numericRange':
      return buildNumericRangeNode(filter, field)

    case 'dateRange':
      return buildDateRangeNode(filter, field)

    case 'idValue':
      return valuesNode(filter, field, value => escapeIdValue(unescapeIdValue(value)))

    case 'capitalisedValue':
      return valuesNode(filter, field, value => escapeValue(value.charAt(0).toUpperCase() + value.slice(1)))

    case 'string':
      return buildStringNode(filter, field)

    case 'openEndedString':
      return buildOpenEndedStringNode(filter, field)

    case 'regex':
      return buildRegexNode(filter, field)

    case 'joinCollection':
      return buildJoinCollectionNode(filter, field, configuration, features)

    case 'embeddingKnnSimilarity':
      return buildEmbeddingKnnSimilarityNode(filter, field)

    default:
      // 'value', 'imageTypeValueOrLabel' and any future default rule.
      return valuesNode(filter, field)
  }
}

// ---------------------------------------------------------------------------
// Query assembly
// ---------------------------------------------------------------------------

/**
 * Group filters by type (and context, unless the rule handles context itself),
 * so filters of the same kind are combined into a single clause.
 */
function groupFilters(
  filters: Filter[],
  definitions: IndexDefinition['filters'],
  solrNamespace: SolrNamespace
): Map<string, Group> {
  const groups = new Map<string, Group>()

  for (const filter of filters) {
    const definition = definitions[filter.type]
    if (!definition) {
      throw new InvalidArgumentError(`Unknown filter type "${filter.type}" in namespace "${solrNamespace}"`)
    }

    const rule = ruleRegistry[definition.rule]
    const context = filter.context ?? 'include'

    // Rules that handle context internally (e.g. joinCollection) merge include
    // and exclude filters into one group; all others are grouped per context.
    const key = rule.handlesContext ? filter.type : `${filter.type}:${context}`

    const group = groups.get(key)
    if (group) {
      group.filters.push(filter)
    } else {
      groups.set(key, {
        type: filter.type,
        context,
        definition: definition as Group['definition'],
        filters: [filter],
      })
    }
  }

  return groups
}

interface PartitionedNodes {
  /** Nodes that contribute to relevance scoring (become the `query`). */
  scored: SolrQueryNode[]
  /** Nodes that only filter (become the `filter`). */
  unscored: SolrQueryNode[]
  /** Excluded nodes (wrapped in a `must_not` clause). */
  negated: SolrQueryNode[]
  /** The single KNN node, if any. */
  knn?: SolrQueryNode
  /** Filter type that produced the KNN node (for error messages). */
  knnType: string
  /** Number of KNN nodes encountered (more than one is an error). */
  knnCount: number
}

/** Build query nodes for every group and sort them into scored / unscored / negated / knn buckets. */
function partitionGroupNodes(
  groups: Map<string, Group>,
  solrNamespaceConfiguration: SolrServerNamespaceConfiguration[],
  featuresConfig: FeaturesConfig
): PartitionedNodes {
  const result: PartitionedNodes = {
    scored: [],
    unscored: [],
    negated: [],
    knn: undefined,
    knnType: '',
    knnCount: 0,
  }

  for (const group of groups.values()) {
    const rule = ruleRegistry[group.definition.rule]
    const nodes = group.filters.map(filter =>
      buildNode(filter, group, solrNamespaceConfiguration, featuresConfig)
    )

    // Exclusive rules (KNN) become the top-level query on their own.
    if (rule.exclusive) {
      result.knnCount += nodes.length
      result.knn ??= nodes[0]
      result.knnType ||= group.type
      continue
    }

    // Join subqueries for one collection filter type are ANDed together and
    // always act as filters, regardless of the `scoring` flag.
    if (group.definition.rule === 'joinCollection') {
      result.unscored.push(andNode(nodes))
      continue
    }

    if (group.context === 'exclude') {
      result.negated.push(...nodes)
    } else if (group.definition.scoring) {
      result.scored.push(...nodes)
    } else {
      result.unscored.push(...nodes)
    }
  }

  return result
}

/**
 * When ordering by `$topicRelevanceScore`, compute the score as the sum of
 * per-topic payloads and expose it as the `topicRelevanceScore` query parameter.
 */
function topicRelevanceScoreParams(filters: Filter[]): Record<string, string> {
  const payloads = filters
    .filter(filter => filter.type === 'topic' && filter.q)
    .flatMap(filter => leafValues(filter).map(value => `payload(topics_dpfs,${escapeIdValue(value)})`))

  return { topicRelevanceScore: payloads.length ? `sum(${payloads.join(',')})` : '0' }
}

export function buildSolrQuery(
  filters: Filter[],
  solrNamespace: SolrNamespace,
  solrNamespaceConfiguration: SolrServerNamespaceConfiguration[],
  featuresConfig: FeaturesConfig,
  options: BuildSolrQueryOptions = {}
): SolrJsonQueryBody {
  if (!Object.values(SolrNamespaces).includes(solrNamespace)) {
    throw new InvalidArgumentError(`Unknown Solr namespace: ${solrNamespace}`)
  }

  const definitions = registry[solrNamespace]?.filters ?? {}
  const groups = groupFilters(filters, definitions, solrNamespace)
  const { scored, unscored, negated, knn, knnType, knnCount } = partitionGroupNodes(
    groups,
    solrNamespaceConfiguration,
    featuresConfig
  )

  if (knnCount > 1) {
    throw new InvalidArgumentError(`Only one "${knnType}" filter is supported per request; received ${knnCount}`)
  }

  const params: SolrJsonQueryBody['params'] = {}
  if (options.orderBy?.includes('$topicRelevanceScore')) {
    Object.assign(params, topicRelevanceScoreParams(filters))
  }

  // Excluded clauses are wrapped in a bool query that matches everything except them.
  const negation = negated.length
    ? { bool: { must: ['*:*'] as SolrQueryNode[], must_not: negated } }
    : undefined

  // With a KNN query, everything (including scoring clauses) becomes a filter,
  // and highlighting is disabled since it is not supported for KNN queries.
  const result: SolrJsonQueryBody = knn
    ? {
        query: knn,
        filter: [...unscored, ...scored, ...(negation ? [negation] : [])],
        params: { ...params, hl: false },
      }
    : {
        query: scored.length ? andNode(scored) : '*:*',
        filter: [...unscored, ...(negation ? [negation] : [])],
        params,
      }

  if (options.extractVariables) {
    const minLength = typeof options.extractVariables === 'object' ? options.extractVariables.minLength : 1024
    const sequence = { value: 0 }
    result.query = extractLongLeaves(result.query, result.params, minLength, sequence)
    result.filter = result.filter.map(node => extractLongLeaves(node, result.params, minLength, sequence))
  }

  return result
}
