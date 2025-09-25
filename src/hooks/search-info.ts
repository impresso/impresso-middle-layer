import { HookContext } from '@feathersjs/feathers'
import { AppServices, ImpressoApplication } from '../types'
import { mediaSourceToNewspaper } from '../services/newspapers/newspapers.class'
import { buildResolvers } from '../internalServices/cachedResolvers'

import debugLib from 'debug'
const debug = debugLib('impresso/hooks:search-info')

/**
 * check if there are any params to be added to our beloved facets.
 * This hook **must** follow facets validation.
 * @return {[type]}        [description]
 */
const filtersToSolrFacetQuery = () => async (context: HookContext<ImpressoApplication, AppServices>) => {
  if (!context.params.sanitized.facets) {
    debug("'filtersToSolrFacetQuery' warning, no facets requested.")
    return
  }
  if (typeof context.params.sanitized !== 'object') {
    throw new Error("The 'filtersToSolrQuery' hook should be used after a 'validate' hook.")
  }
  const facets = JSON.parse(context.params.sanitized.facets)
  const facetFields = Object.keys(facets)
  debug("'filtersToSolrFacetQuery' on facets:", facets)

  // prefix facet with user id...
  if (facets.collection) {
    if (context.params && context.params.user) {
      debug(`'filtersToSolrFacetQuery' on user collection ${context.params.user.uid}`)
      facets.collection.prefix = context.params.user.uid
    }
  }

  if (!Array.isArray(context.params.sanitized.facetfilters)) {
    context.params.sanitized.facetfilters = []
  }

  // apply facets recursively based on facet name
  facetFields.forEach(key => {
    const filter = context.params.sanitized.facetfilters.find((d: any) => d.name === key)
    if (filter) {
      debug(`filtersToSolrFacetQuery' on facet ${key}:`, filter)
    }
  })
  // rewrite facets json
  debug("'filtersToSolrFacetQuery' facets rewritten:", facets)
  context.params.sanitized.facets = JSON.stringify(facets)
}

const resolveFacets = () => async (context: HookContext<ImpressoApplication, AppServices>) => {
  if (context.result && context.result.info && context.result.info.facets) {
    // enrich facets
    if (context.result.info.facets.newspaper) {
      debug('resolveFacets for newspaper')
      const mediaSourcesLookup = await context.app.service('media-sources').getLookup()

      context.result.info.facets.newspaper.buckets = context.result.info.facets.newspaper.buckets.map((d: any) => ({
        ...d,
        item: mediaSourcesLookup[d.val] != null ? mediaSourceToNewspaper(mediaSourcesLookup[d.val]) : undefined,
        uid: d.val,
      }))
    }

    if (context.result.info.facets.topic) {
      debug('resolveFacets for topics')
      const resolvers = buildResolvers(context.app)
      context.result.info.facets.topic.buckets = await Promise.all(
        context.result.info.facets.newspaper.buckets.map(async (d: any) => ({
          ...d,
          item: await resolvers.topic(d.val),
          uid: d.val,
        }))
      )
    }
  }
}

const resolveQueryComponents = () => async (context: HookContext<ImpressoApplication, AppServices>) => {
  debug('resolveQueryComponents', context.params.sanitized.queryComponents)

  const mediaSourcesLookup = await context.app.service('media-sources').getLookup()

  for (let i = 0, l = context.params.sanitized.queryComponents.length; i < l; i += 1) {
    const d = {
      ...context.params.sanitized.queryComponents[i],
    }
    if (d.type === 'newspaper') {
      if (!Array.isArray(d.q)) {
        d.items = [mediaSourceToNewspaper(mediaSourcesLookup[d.q])]
      } else {
        d.items = d.q.map((uid: string) => mediaSourceToNewspaper(mediaSourcesLookup[uid]))
      }
    } else if (d.type === 'topic') {
      const resolvers = buildResolvers(context.app)

      if (!Array.isArray(d.q)) {
        d.items = [resolvers.topic(d.q)]
      } else {
        d.items = await Promise.all(d.q.map(async (uid: string) => await resolvers.topic(uid)))
      }
    } else if (d.type === 'collection' && context.params.user) {
      // eslint-disable-next-line no-await-in-loop
      d.items = await context.app
        .service('collections')
        .find({
          user: context.params.user,
          query: {
            uids: d.q,
          },
        })
        .then((res: any) => res.data)
    } else {
      debug('cannot resolve for type', d.type, 'item:', d)
    }
    context.params.sanitized.queryComponents[i] = d
  }
}

export { filtersToSolrFacetQuery, resolveFacets, resolveQueryComponents }
