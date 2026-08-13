import type {
  FeaturesConfig,
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
const shapeOf = (field: Field): FieldShape =>
  typeof field === 'string' ? 'string' : Array.isArray(field) ? 'string[]' : 'prefix'
for (const [namespace, index] of Object.entries(registry))
  for (const [type, definition] of Object.entries(index.filters)) {
    const rule = ruleRegistry[definition.rule]
    if (!rule)
      throw new InvalidArgumentError(
        `Unknown rule "${definition.rule}" for filter type "${type}" in namespace "${namespace}"`
      )
    if (!rule.accepts.includes(shapeOf(definition.field as Field)))
      throw new InvalidArgumentError(
        `Rule "${definition.rule}" does not accept field shape ${shapeOf(definition.field as Field)} (filter type "${type}", namespace "${namespace}")`
      )
  }

const orNode = (nodes: SolrQueryNode[]): SolrQueryNode =>
  nodes.length === 1 ? nodes[0] : { bool: { should: nodes, minimum_should_match: 1 } }
const andNode = (nodes: SolrQueryNode[]): SolrQueryNode => (nodes.length === 1 ? nodes[0] : { bool: { must: nodes } })
const fieldsFor = (field: Field): string[] =>
  typeof field === 'string'
    ? [field]
    : Array.isArray(field)
      ? field
      : SupportedLanguageCodes.map(language => `${field.prefix}${language}`).concat(field.prefix.slice(0, -1))
const escapeValue = (value: string) => value.replace(/[()\\+&|!{}[\]?:;,^]/g, character => `\\${character}`)
const leafValues = (filter: Filter) =>
  Array.isArray(filter.q) ? (filter.q.length ? filter.q : ['*']) : filter.q && filter.q.trim() ? [filter.q] : ['*']
const valuesNode = (filter: Filter, field: Field, transform = escapeValue) => {
  const values = leafValues(filter).map(value =>
    orNode(fieldsFor(field).map(solrField => `${solrField}:${value === '*' ? '*' : transform(value)}`))
  )
  return filter.op === 'AND' ? andNode(values) : orNode(values)
}
const date = (value: string, bound: 'start' | 'end') =>
  /^\d{4}$/.test(value)
    ? `${value}-01-01T${bound === 'start' ? '00:00:00' : '23:59:59'}Z`
    : /^\d{4}-\d{2}$/.test(value)
      ? `${value}-01T${bound === 'start' ? '00:00:00' : '23:59:59'}Z`
      : /^\d{4}-\d{2}-\d{2}$/.test(value)
        ? `${value}T${bound === 'start' ? '00:00:00' : '23:59:59'}Z`
        : value
const dateLeaf = (value: string, field: string) => {
  const parts = value.trim().split(/\s+TO\s+/)
  if (parts.length === 2)
    return `${field}:[${date(parts[0], 'start')} TO ${date(parts[1], 'end').replace('T00:00:00Z', 'T23:59:59Z')}]`
  if (/^\d{4}$/.test(value)) return `${field}:[${value}-01-01T00:00:00Z TO ${value}-12-31T23:59:59Z]`
  return `${field}:[${value}]`
}
const vector = (base64: string) => {
  const buffer = Buffer.from(base64, 'base64')
  return JSON.stringify(Array.from(new Float32Array(buffer.buffer, buffer.byteOffset, buffer.length / 4)))
}

const extractLongLeaves = (
  node: SolrQueryNode,
  params: SolrJsonQueryBody['params'],
  minLength: number,
  sequence: { value: number }
): SolrQueryNode => {
  if (typeof node === 'string') {
    if (node.length <= minLength) return node
    const key = `v${sequence.value++}`
    params[key] = node
    return `$${key}`
  }
  if (!('bool' in node)) return node
  const bool = (node as { bool: SolrBoolNode }).bool
  return {
    bool: {
      ...(bool.must ? { must: bool.must.map(child => extractLongLeaves(child, params, minLength, sequence)) } : {}),
      ...(bool.must_not
        ? { must_not: bool.must_not.map(child => extractLongLeaves(child, params, minLength, sequence)) }
        : {}),
      ...(bool.should
        ? { should: bool.should.map(child => extractLongLeaves(child, params, minLength, sequence)) }
        : {}),
      ...(bool.minimum_should_match != null ? { minimum_should_match: bool.minimum_should_match } : {}),
    },
  }
}

const buildNode = (
  filter: Filter,
  group: Group,
  configuration: SolrServerNamespaceConfiguration[],
  features: FeaturesConfig
): SolrQueryNode => {
  const { field, rule } = group.definition
  if (rule === 'minLengthOne') return `${field as string}:[1 TO *]`
  if (rule === 'boolean') return `${field as string}:1`
  if (rule === 'noop') return '*:*'
  if (rule === 'numericRange') {
    if (Array.isArray(filter.q)) {
      if (filter.q.length !== 2 || !filter.q.every(value => Number.isFinite(parseInt(value, 10))))
        throw new InvalidArgumentError(`"numericRange" filter rule: unknown values encountered in "q": ${filter.q}`)
      return `${field as string}:[${filter.q[0]} TO ${filter.q[1]}]`
    }
    if (filter.q != null) {
      if (!/^\s*\d+\s+TO\s+\d+\s*$/.test(filter.q))
        throw new InvalidArgumentError(`"numericRange" filter rule: unknown value encountered in "q": ${filter.q}`)
      return `${field as string}:[${filter.q}]`
    }
    return `${field as string}:*`
  }
  if (rule === 'dateRange') {
    if (Array.isArray(filter.q)) {
      if (!filter.q.length)
        throw new InvalidArgumentError(`"dateRange" filter rule: array "q" must have exactly 2 elements: ${filter.q}`)
      if (filter.q.length === 2 && !filter.q[0].includes(' TO ') && !filter.q[1].includes(' TO '))
        return `${field as string}:[${date(filter.q[0], 'start')} TO ${date(filter.q[1], 'end')}]`
      return orNode(filter.q.map(value => dateLeaf(value, field as string)))
    }
    if (filter.q) return dateLeaf(filter.q, field as string)
    return `${field as string}:*`
  }
  if (rule === 'idValue') return valuesNode(filter, field, value => escapeIdValue(unescapeIdValue(value)))
  if (rule === 'capitalisedValue')
    return valuesNode(filter, field, value => escapeValue(value.charAt(0).toUpperCase() + value.slice(1)))
  if (rule === 'string') {
    const values = Array.isArray(filter.q) ? filter.q.filter(Boolean) : filter.q ? [filter.q] : ['*']
    const nodes = values.map(value =>
      orNode(fieldsFor(field).map(solrField => `${solrField}:${value === '*' ? '*' : escapeValue(value)}`))
    )
    return filter.op === 'AND' ? andNode(nodes) : orNode(nodes)
  }
  if (rule === 'openEndedString') {
    const values = leafValues(filter).map(value =>
      andNode(
        value
          .split(' ')
          .filter(Boolean)
          .map(
            (part, index, parts) =>
              `${field as string}:${part.replace(/"/g, '\\"').replace(/[()]/g, '')}${index === parts.length - 1 ? '*' : ''}`
          )
      )
    )
    return filter.op === 'AND' ? andNode(values) : orNode(values)
  }
  if (rule === 'regex') {
    if (Array.isArray(filter.q) && filter.q.length > 1)
      throw new InvalidArgumentError(
        `"regex" filter rule supports only single element arrays in "q": ${JSON.stringify(filter.q)}`
      )
    const raw = (Array.isArray(filter.q) ? filter.q[0] : filter.q) ?? '/.*/'
    const fragments = raw
      .replace(/^\/|\/$/g, '')
      .split(/\\?\.[*+]/)
      .filter(Boolean)
    return andNode(
      (fragments.length ? fragments : ['.*']).map(fragment =>
        orNode(fieldsFor(field).map(solrField => `${solrField}:/${fragment}/`))
      )
    )
  }
  if (rule === 'joinCollection') {
    const namespace = configuration.find(item => item.namespaceId === SolrNamespaces.CollectionItems)
    if (!namespace)
      throw new InvalidArgumentError(
        `Could not find Solr namespace configuration for "${SolrNamespaces.CollectionItems}" required for "joinCollection" filter`
      )
    const ids = leafValues(filter).filter(value => value !== '*')
    if (!ids.length)
      throw new InvalidArgumentError('At least one collection ID must be provided for "joinCollection" filter')
    return {
      join: {
        from: 'ci_id_s',
        to: field as string,
        fromIndex: namespace.index,
        method: features.collectionsIndexVersion === 'new' ? 'index' : 'crossCollection',
        ...(features.collectionsIndexVersion === 'new' ? { checkRouterField: false } : {}),
        // Deliberately preserved legacy behaviour: excludes are negated inside
        // the join subquery, rather than becoming an outer must_not clause.
        query: ids.map(id => `${filter.context === 'exclude' ? 'NOT ' : ''}col_id_s:*_${id}`).join(` ${filter.op ?? 'OR'} `),
      },
    }
  }
  if (rule === 'embeddingKnnSimilarity') {
    const source = Array.isArray(filter.q) ? filter.q[0] : filter.q
    if (!source?.includes(':'))
      throw new InvalidArgumentError(
        `"embeddingKnnSimilarity" filter rule requires "q" to be a string in the format "model:base64_encoded_vector", e.g. "openclip-768:BASE64_ENCODED_VECTOR". Received: ${JSON.stringify(filter.q)}`
      )
    const [model, encoded, topK] = source.split(':')
    const models = Object.fromEntries((field as string[]).map(entry => entry.split(':')))
    if (!models[model])
      throw new InvalidArgumentError(
        `"embeddingKnnSimilarity" filter rule: unknown model "${model}". Supported models: ${Object.keys(models).join(', ')}`
      )
    return {
      knn: {
        f: models[model],
        topK: Number.isFinite(parseInt(topK, 10)) ? parseInt(topK, 10) : 10,
        query: vector(encoded),
      },
    }
  }
  return valuesNode(filter, field)
}

export function buildSolrQuery(
  filters: Filter[],
  solrNamespace: SolrNamespace,
  solrNamespaceConfiguration: SolrServerNamespaceConfiguration[],
  featuresConfig: FeaturesConfig,
  options: BuildSolrQueryOptions = {}
): SolrJsonQueryBody {
  if (!Object.values(SolrNamespaces).includes(solrNamespace))
    throw new InvalidArgumentError(`Unknown Solr namespace: ${solrNamespace}`)
  const definitions = registry[solrNamespace]?.filters ?? {}
  const groups = new Map<string, Group>()
  for (const filter of filters) {
    const definition = definitions[filter.type]
    if (!definition)
      throw new InvalidArgumentError(`Unknown filter type "${filter.type}" in namespace "${solrNamespace}"`)
    const rule = ruleRegistry[definition.rule]
    const context = filter.context ?? 'include'
    const key = rule.handlesContext ? filter.type : `${filter.type}:${context}`
    const group = groups.get(key)
    if (group) group.filters.push(filter)
    else
      groups.set(key, { type: filter.type, context, definition: definition as Group['definition'], filters: [filter] })
  }
  const scored: SolrQueryNode[] = []
  const unscored: SolrQueryNode[] = []
  const negated: SolrQueryNode[] = []
  let knn: SolrQueryNode | undefined
  let knnType = ''
  let knnCount = 0
  for (const group of groups.values()) {
    const rule = ruleRegistry[group.definition.rule]
    const nodes = group.filters.map(filter => buildNode(filter, group, solrNamespaceConfiguration, featuresConfig))
    if (rule.exclusive) {
      knnCount += nodes.length
      knn ??= nodes[0]
      knnType ||= group.type
      continue
    }
    if (group.definition.rule === 'joinCollection') {
      unscored.push(andNode(nodes))
      continue
    }
    if (group.context === 'exclude') negated.push(...nodes)
    else if (group.definition.scoring) scored.push(...nodes)
    else unscored.push(...nodes)
  }
  if (knnCount > 1)
    throw new InvalidArgumentError(`Only one "${knnType}" filter is supported per request; received ${knnCount}`)
  const params: SolrJsonQueryBody['params'] = {}
  if (options.orderBy?.includes('$topicRelevanceScore')) {
    const payloads = filters
      .filter(filter => filter.type === 'topic' && filter.q)
      .flatMap(filter => leafValues(filter).map(value => `payload(topics_dpfs,${escapeIdValue(value)})`))
    params.topicRelevanceScore = payloads.length ? `sum(${payloads.join(',')})` : '0'
  }
  const negation = negated.length ? { bool: { must: ['*:*'] as SolrQueryNode[], must_not: negated } } : undefined
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
