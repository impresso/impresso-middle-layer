import assert from 'assert'
import { groupBy, includes, uniq, values } from 'lodash'
import { Filter } from '../../models'
import { SolrNamespace, SolrNamespaces } from '../../solr'
import { filtersToSolr } from './filterReducers'
import { LanguageCode, PrintContentItem, SupportedLanguageCodes } from '../../models/solr'
import { SelectRequestBody } from '../../internalServices/simpleSolr'

/**
 * Fields names that should not be wrapped into `filter(...)` when
 * used in `q` Solr parameter.
 *
 * TODO: Explain why.
 */
const NON_FILTERED_FIELDS = ['uid', 'string', 'entity-string', 'topic-string']

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
 * @deprecated use `filtersToQueryAndVariables`
 * Return a section of the Solr query based on the filters **of the same type**.
 * @param {Filter[]} filters a list of filters (`src/schema/search/filter.json`).
 * @param {string} solrNamespace index to use (see `src/solr.js` - `SolrNamespaces`)
 *
 * @return {string} a Solr query.
 */
function sameTypeFiltersToQuery(filters: Filter[], solrNamespace: SolrNamespace = SolrNamespaces.Search) {
  assert.ok(Object.values(SolrNamespaces).includes(solrNamespace), `Unknown Solr namespace: ${solrNamespace}`)

  const filtersTypes = uniq(filters.map(f => f.type))
  assert.equal(filtersTypes.length, 1, `Filters must be of the same type but they are of: ${filtersTypes.join(', ')}`)

  const type = filtersTypes[0]
  const { query: statement, destination } = filtersToSolr(filters, solrNamespace)

  return includes(NON_FILTERED_FIELDS, type) ? statement : `filter(${statement})`
}

/**
 * @deprecated use `filtersToQueryAndVariables`
 */
const filtersToSolrQueries = (filters: Filter[], namespace: SolrNamespace) => {
  const filtersGroupsByType = values(groupBy(filters, 'type'))
  return uniq(filtersGroupsByType.map(f => sameTypeFiltersToQuery(f, namespace)))
}

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
  solrNamespace: SolrNamespace = SolrNamespaces.Search
): SolrQueryBase {
  assert.ok(Object.values(SolrNamespaces).includes(solrNamespace), `Unknown Solr namespace: ${solrNamespace}`)

  const filtersGroupedByType = groupBy(filters, 'type')

  const variables: Record<string, string | number | boolean> = {}
  const queries: string[] = []
  const solrFilters: string[] = []

  Object.keys(filtersGroupedByType).forEach(key => {
    const { query: baseSolrQueryFilter, destination } = filtersToSolr(filtersGroupedByType[key], solrNamespace)
    const filterQuery = NON_FILTERED_FIELDS.includes(key) ? baseSolrQueryFilter : wrapAsFilter(baseSolrQueryFilter)

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
