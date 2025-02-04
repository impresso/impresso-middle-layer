import assert from 'assert'
import { groupBy, includes, uniq, values } from 'lodash'
import { Filter } from '../../models'
import { SolrNamespace, SolrNamespaces } from '../../solr'
import { escapeValue, filtersToSolr } from './filterReducers'

/**
 * Languages that have content indexes in Solr.
 */
export const ContentLanguages = ['en', 'fr', 'de']

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
 * Return a section of the Solr query based on the filters **of the same type**.
 * @param {import('../../models').Filter[]} filters a list of
 *        filters (`src/schema/search/filter.json`).
 * @param {string} solrNamespace index to use (see `src/solr.js` - `SolrNamespaces`)
 *
 * @return {string} a Solr query.
 */
export function sameTypeFiltersToQuery(filters: Filter[], solrNamespace: SolrNamespace = SolrNamespaces.Search) {
  assert.ok(Object.values(SolrNamespaces).includes(solrNamespace), `Unknown Solr namespace: ${solrNamespace}`)

  const filtersTypes = uniq(filters.map(f => f.type))
  assert.equal(filtersTypes.length, 1, `Filters must be of the same type but they are of: ${filtersTypes.join(', ')}`)

  const type = filtersTypes[0]
  const statement = filtersToSolr(filters, solrNamespace)

  return includes(NON_FILTERED_FIELDS, type) ? statement : `filter(${statement})`
}

export const filtersToSolrQueries = (filters: Filter[], namespace: SolrNamespace) => {
  const filtersGroupsByType = values(groupBy(filters, 'type'))
  return uniq(filtersGroupsByType.map(f => sameTypeFiltersToQuery(f, namespace)))
}

/**
 * @typedef SolrQueryAndVariables
 * @property {string} query Solr query string (`q` field)
 * @property {Object.<string, string>} variables variables that are referenced in `query`
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
 * @return {SolrQueryAndVariables}
 */
export function filtersToQueryAndVariables(filters: Filter[], solrNamespace: SolrNamespace = SolrNamespaces.Search) {
  assert.ok(Object.values(SolrNamespaces).includes(solrNamespace), `Unknown Solr namespace: ${solrNamespace}`)

  const filtersGroupedByType = groupBy(filters, 'type')

  /** @type {Object.<string, string>} */
  const variables: Record<string, string> = {}
  const queries: string[] = []

  Object.keys(filtersGroupedByType).forEach(key => {
    if (NON_FILTERED_FIELDS.indexOf(key) !== -1) {
      queries.push(filtersToSolr(filtersGroupedByType[key], solrNamespace))
    } else {
      queries.push(wrapAsFilter(filtersToSolr(filtersGroupedByType[key], solrNamespace)))
    }
    if (SOLR_FILTER_DPF[key]) {
      // add payload variable. E.g.: payload(topics_dpf,tmGDL_tp04_fr)
      reduceFiltersToVars(filtersGroupedByType[key]).forEach(d => {
        const l = Object.keys(variables).length
        const field = SOLR_FILTER_DPF[key]
        variables[`v${l}`] = `payload(${field},${escapeValue(d)})`
      })
    }
  })

  return {
    query: queries.length ? queries.join(' AND ') : '*:*',
    variables,
  }
}

interface DocWithRegionCoordinates {
  rc_plains?: string | string[]
  pp_plain?: any[]
}

export function getRegionCoordinatesFromDocument(document: DocWithRegionCoordinates) {
  if (document.rc_plains) {
    const rcPlainsArray = typeof document.rc_plains === 'string' ? [document.rc_plains] : document.rc_plains
    return rcPlainsArray.map(d => {
      const page = JSON.parse(d.replace(/'/g, '"'))
      return {
        id: page.pid,
        r: page.c,
      }
    })
  }
  if (document.pp_plain) {
    return document.pp_plain
  }
  return []
}
