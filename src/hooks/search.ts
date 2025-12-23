import Debug from 'debug'
import lodash from 'lodash'

import { filtersToQueryAndVariables } from '@/util/solr/index.js'
import { SolrNamespaces } from '@/solr.js'
import { HookContext } from '@feathersjs/feathers'

const debug = Debug('impresso/hooks:search')

/**
 * Transform a term parameter to a string filter.
 * @param  {string} term query parameter
 */
export const termToSolrFilter =
  (field = 'q') =>
  (context: HookContext) => {
    if (context.type !== 'before') {
      throw new Error("[termToSolrFilter] hook should only be used as a 'before' hook.")
    }
    if (typeof context.params.sanitized !== 'object') {
      throw new Error("[termToSolrFilter] hook should be used after a 'validate' hook.")
    }
    if (!Array.isArray(context.params.sanitized.filters)) {
      context.params.sanitized.filters = []
    }
    if (context.params.sanitized[field]) {
      context.params.sanitized.filters.unshift({
        context: 'include',
        type: 'string',
        fuzzy: false,
        standalone: false,
        q: context.params.sanitized[field],
      })
    }
  }

/**
 * filtersToSolrQuery transform string filters
 * in `context.params.sanitized.filters` array to a smart SOLR query
 *
 * and returns the Solr index filters should be validated against.
 */
// prettier-ignore
export const filtersToSolrQuery =
  ({
    overrideOrderBy = true,
    prop = 'params',
    solrIndexProvider = (_ctx: any) => SolrNamespaces.Search // eslint-disable-line no-unused-vars
  } = {}) => async (context: HookContext) => {
    const prefix = `[filtersToSolrQuery (${context.path}.${context.method})]`
    if (context.type !== 'before') {
      throw new Error(`${prefix} hook should only be used as a 'before' hook.`)
    }
    if (typeof context[prop].sanitized !== 'object') {
      context[prop].sanitized = {}
    }
    if (!Array.isArray(context[prop].sanitized.filters)) {
      context[prop].sanitized.filters = []
    }
    if (!context[prop].sanitized.filters.length && !context[prop].sanitized.q) {
      // nothing is give, wildcard then.
      debug(`${prefix} with 'solr query': *:*`)
      context[prop].sanitized.sq = '*:*'
      context[prop].sanitized.queryComponents = []
      return
    }

    const { query, filter: solrFilter, params: vars } = filtersToQueryAndVariables(
      context[prop].sanitized.filters,
      solrIndexProvider(context),
      context.app.get('solrConfiguration').namespaces
    )

    // prepend order by if it is not relevance
    if (overrideOrderBy && Object.keys(vars ?? {}).length) {
      // relevance direction
      let direction = 'desc'
      if (context[prop].sanitized.order_by && context[prop].sanitized.order_by.indexOf('score asc') > -1) {
        direction = 'asc'
      }
      const varsOrderBy = Object.keys(vars ?? {}).map(v => `\${${v}} ${direction}`)
      // if order by is by relevance:
      if (context[prop].sanitized.order_by && context[prop].sanitized.order_by.indexOf('score') === 0) {
        context[prop].sanitized.order_by = varsOrderBy.concat(context[prop].sanitized.order_by.split(',')).join(',')
      } else if (context[prop].sanitized.order_by) {
        context[prop].sanitized.order_by = context[prop].sanitized.order_by.split(',').concat(varsOrderBy).join(',')
      } else {
        context[prop].sanitized.order_by = varsOrderBy.join(',')
      }
    }
    debug(`${prefix} query order_by:`, context[prop].sanitized.order_by)
    debug(`${prefix} vars =`, vars, context[prop].sanitized)

    // context[prop].query.order_by.push()

    context[prop].sanitized.sq = query
    // context[prop].sanitized.sfq = filterQueries.join(' AND ');
    context[prop].sanitized.sv = vars
    context[prop].sanitized.sfq = solrFilter
    // NOTE: `queryComponents` should be deprecated
    const filters = lodash.groupBy(context[prop].sanitized.filters, 'type')
    context[prop].sanitized.queryComponents = ([] as any[])
      .concat(
        filters.isFront,
        filters.years,
        filters.newspaper,
        filters.topic,
        filters.person,
        filters.location,
        filters.collection,
        filters.language,
        filters.daterange,
        filters.type,
        filters.country,
        filters.string,
        filters.title,
        filters.issue,
        filters.page
      )
      .filter(d => typeof d !== 'undefined')
    debug(`${prefix} with 'solr query': ${context[prop].sanitized.sq}`)
  }

/**
 * check if there are any params to be added to our beloved facets. should follow facets validation
 * @return {[type]}        [description]
 */
export const filtersToSolrFacetQuery = () => async (context: HookContext) => {
  if (!context.params.sanitized.facets) {
    debug('[filtersToSolrFacetQuery] WARN no facets requested.')
    return
  }
  if (typeof context.params.sanitized !== 'object') {
    throw new Error("[filtersToSolrFacetQuery] hook should be used after a 'validate' hook.")
  }
  const facets = JSON.parse(context.params.sanitized.facets)
  debug('[filtersToSolrFacetQuery] on facets:', facets)

  if (!Array.isArray(context.params.sanitized.facetfilters)) {
    context.params.sanitized.facetfilters = []
  }
  // apply facets recursively based on facet name
  Object.keys(facets).forEach(key => {
    const filter = context.params.sanitized.facetfilters.find((d: any) => d.name === key)
    if (filter) {
      debug(`[filtersToSolrFacetQuery] on facet ${key}:`, filter)
    }
  })
}

export const queries = { hasTextContents: 'content_length_i:[1 TO *]' }
