import { consolidateMediaSources } from '../useCases/consolidateMediaSources'
import { WellKnownKeys } from '../cache'
import { ImpressoApplication } from '../types'
import { getSolrIndex, SolrNamespaces } from '../solr'

/**
 * Consolidate media sources and store them in cache.
 */
const run = async (app: ImpressoApplication) => {
  const dbClient = app.get('sequelizeClient')!
  const cache = app.get('cacheManager')
  const solrClient = app.service('simpleSolrClient')

  const sources = await consolidateMediaSources(dbClient, solrClient, SolrNamespaces.Search)
  await cache.set(WellKnownKeys.MediaSources, JSON.stringify(sources))
}

export default run
