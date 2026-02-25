import assert from 'assert'
import { groupBy } from 'lodash-es'
import { Filter } from '@/models/index.js'
import { SolrNamespace, SolrNamespaces } from '@/solr.js'
import { filtersToSolr } from '@/util/solr/filterReducers.js'
import { LanguageCode, PrintContentItem, SupportedLanguageCodes } from '@/models/solr.js'
import { SelectRequestBody } from '@/internalServices/simpleSolr.js'
import { SolrServerNamespaceConfiguration } from '@/models/generated/common.js'
import { escapeIdValue } from '@/util/solr/filterBuilders/value.js'

/**
 * Type representing the `score` field in Solr documents.
 * This field is typically used to represent the relevance score of a document.
 */
export const ScoreField = 'score'

/**
 * Type representing an object of type T with an additional `score` field.
 */
export type WithScore<T> = T & {
  score?: number
}

/**
 * Fields names that should not be wrapped into `filter(...)` when
 * used in `q` Solr parameter.
 *
 * TODO: Explain why.
 */
const NON_FILTERED_FIELDS = ['uid', 'string', 'entity-string', 'topic-string', 'embedding']

/**
 * Translate DPF filter to appropriate field names
 */
const SOLR_FILTER_DPF: Record<string, string> = {
  topic: 'topics_dpfs',
  person: 'pers_entities_dpfs',
  location: 'loc_entities_dpfs',
}

const reduceFiltersToVars = (filters: Filter[]) =>
  filters.reduce((sq, filter) => {
    if (Array.isArray(filter.q)) {
      filter.q.forEach(q => {
        sq.push(q)
      })
    } else if (filter.q != null) {
      sq.push(filter.q)
    }
    return sq
  }, [] as string[])

/**
 * The fields that can be constructed using filter reducers:
 * - `query` - main query
 * - `filter` - filter query
 */
type SolrQueryBase = Pick<SelectRequestBody, 'query' | 'filter' | 'params'>

/**
 * TODO: explain why it's needed and why it does `substr(4)`
 */
const wrapAsFilter = (q: string) => {
  if (q.startsWith('NOT ')) {
    return `NOT filter(${q.substr(4)})`
  }
  return `filter(${q})`
}

/**
 * Return Solr query string and referenced variables for a set of filters.
 * @param {Array<object>} filters a list of filters of type `src/schema/search/filter.json`.
 * @param {string} solrNamespace index to use (see `src/solr.js` - `SolrNamespaces`)
 */
export function filtersToQueryAndVariables(
  filters: Filter[],
  solrNamespace: SolrNamespace = SolrNamespaces.Search,
  solrNamespacesConfiguration: SolrServerNamespaceConfiguration[],
  doNotWrapFilters = false
): SolrQueryBase {
  assert.ok(Object.values(SolrNamespaces).includes(solrNamespace), `Unknown Solr namespace: ${solrNamespace}`)

  const filtersGroupedByType = groupBy(filters, 'type')

  const variables: Record<string, string | number | boolean> = {}
  const queries: string[] = []
  const solrFilters: string[] = []

  Object.keys(filtersGroupedByType).forEach(key => {
    const { query: baseSolrQueryFilter, destination } = filtersToSolr(
      filtersGroupedByType[key],
      solrNamespace,
      solrNamespacesConfiguration
    )

    // We wrap every filter into `filter(...)` except when:
    // - the filter type is in the exclusion list `NON_FILTERED_FIELDS`, meaning it's meant to be used directly in the `q` parameter and affect the score
    // - we are explicitly asked not to wrap filters to influence scoring.
    const filterQuery =
      NON_FILTERED_FIELDS.includes(key) || doNotWrapFilters ? baseSolrQueryFilter : wrapAsFilter(baseSolrQueryFilter)

    if (destination === 'query') {
      queries.push(filterQuery)
    } else if (destination === 'filter') {
      solrFilters.push(baseSolrQueryFilter)
    } else {
      throw new Error(`Unknown filter destination: ${destination}`)
    }

    // NOTE: very likely not used in the code
    // if (SOLR_FILTER_DPF[key]) {
    //   // add payload variable. E.g.: payload(topics_dpf,tmGDL_tp04_fr)
    //   reduceFiltersToVars(filtersGroupedByType[key]).forEach(d => {
    //     const l = Object.keys(variables).length
    //     const field = SOLR_FILTER_DPF[key]
    //     variables[`v${l}`] = `payload(${field},${escapeIdValue(d)})`
    //   })
    // }
  })

  return {
    query: queries.length ? queries.join(' AND ') : '*:*',
    filter: solrFilters,
    params: variables,
  }
}

type DocWithRegionCoordinates = Pick<PrintContentItem, 'rc_plains' | 'pp_plain'>

export function getRegionCoordinatesFromDocument(document: DocWithRegionCoordinates) {
  if (document.rc_plains) {
    const rcPlainsArray = typeof document.rc_plains === 'string' ? [document.rc_plains] : document.rc_plains
    return rcPlainsArray.map((d: string) => {
      const page = JSON.parse(d.replace(/'/g, '"'))
      return {
        id: page.pid,
        r: page.c,
      }
    })
  }
  if (document.pp_plain) {
    const ppPlainArray = typeof document.pp_plain === 'string' ? [document.pp_plain] : document.pp_plain
    return ppPlainArray
  }
  return []
}

export const parsePlainsField = <T extends `${string}_plains`, O>(document: { [K in T]?: string[] }, key: T): O[] => {
  const value = document[key]
  if (!value) return [] as O[]
  return value.reduce((acc, item) => {
    const parsed = JSON.parse(item.replace(/'/g, '"'))
    return [...acc, parsed]
  }, [] as O[])
}

/**
 * Wrap a Solr plain field name as a JSON field.
 * Instructs Solr to treat the field as a JSON object and return it as such.
 *
 * @param fieldName The name of the field to wrap.
 * @returns The wrapped field name.
 */
export const plainFieldAsJson = <T extends `${string}_plain` | `${string}_plains`>(fieldName: T): `${T}:[json]` => {
  if (!fieldName.endsWith('_plain') && !fieldName.endsWith('_plains')) {
    throw new Error(`Field name must end with '_plain' or '_plains': ${fieldName}`)
  }

  return `${fieldName}:[json]`
}

type ContentField = `content_txt_${LanguageCode}` | 'content_txt'
export const allContentFields = [
  'content_txt',
  ...SupportedLanguageCodes.map(lang => `content_txt_${lang}` as ContentField),
] satisfies ContentField[]

/**
 * Given filters, build a topic relevance parameter value for Solr.
 * Example return: "sum(payload(topics_dpfs, tm-fr-all-v2.0_tp44_fr),payload(topics_dpfs, tm-fr-all-v2.0_tp52_fr))"
 *
 * @param filters List of filters
 * @returns {string} Solr function query string or "0" if no topic filters found
 */
export const getTopicRelevanceFunction = (filters: Filter[]): string => {
  const payloads: string[] = []

  filters
    .filter(f => f.type === 'topic' && f.q)
    .forEach(filter => {
      const qs = Array.isArray(filter.q) ? filter.q : [filter.q!]
      qs.forEach(q => {
        // eslint-disable-next-line @typescript-eslint/no-base-to-string
        payloads.push(`payload(topics_dpfs,${escapeIdValue(q.toString())})`)
      })
    })

  if (payloads.length === 0) {
    return '0'
  }

  return `sum(${payloads.join(',')})`
}

/**
 * Given filters and expected orderBy parameter, build Solr params object with sort variables.
 * Currently only supports `$topicRelevanceScore`.
 *
 * @param filters List of filters
 * @param orderBy The orderBy parameter
 * @returns {Record<string, string>} Solr params object
 */
export const getSortParams = (
  filters: Filter[],
  orderBy?: string
): {
  sort: string
  params: Record<string, string>
} => {
  const sort = orderBy ?? 'score desc, id asc'
  const params: Record<string, string> = {}

  if (sort.includes('$topicRelevanceScore')) {
    params['topicRelevanceScore'] = getTopicRelevanceFunction(filters)
  }

  return { sort, params }
}

/**
 * Ensures that a Solr sort string includes sorting by the `id` field,
 * which is required for cursor-based pagination (`cursorMark`) to be stable.
 * If `id asc` or `id desc` is already present, the sort string is returned unchanged.
 * Otherwise `, id asc` is appended.
 *
 * @param sort The Solr sort string (e.g. `"score desc, date_i desc"`)
 * @returns The sort string guaranteed to include an `id` sort clause
 */
export const ensureIdSort = (sort: string): string => {
  if (/\bid\s+(asc|desc)\b/i.test(sort)) return sort
  return sort ? `${sort}, id asc` : 'id asc'
}
