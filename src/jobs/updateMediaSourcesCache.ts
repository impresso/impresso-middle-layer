import { consolidateMediaSources } from '@/useCases/consolidateMediaSources.js'
import { WellKnownKeys } from '@/cache.js'
import { ImpressoApplication } from '@/types.js'
import { SolrNamespaces } from '@/solr.js'

/** 100 days */
const DefaultTtlSeconds = 60 * 60 * 24 * 100 * 1000

/**
 * Consolidate media sources and store them in cache.
 */
const run = async (app: ImpressoApplication) => {
  const dbClient = app.get('sequelizeClient')!
  const cache = app.get('cacheManager')
  const solrClient = app.service('simpleSolrClient')

  const cached = await cache.get(WellKnownKeys.MediaSources)
  if (cached != null) return

  const sources = await consolidateMediaSources(dbClient, solrClient, SolrNamespaces.Search)
  await cache.set(WellKnownKeys.MediaSources, JSON.stringify(sources), DefaultTtlSeconds)
}

export default run
