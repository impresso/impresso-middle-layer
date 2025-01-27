import { consolidateMediaSources } from '../useCases/consolidateMediaSources'
import { WellKnownKeys } from '../cache'
import { ImpressoApplication } from '../types'
import { SolrNamespaces } from '../solr'

/** 100 days */
const DefaultTtlSeconds = 60 * 60 * 24 * 100

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
