import { consolidateMediaSources } from '@/useCases/consolidateMediaSources.js'
import { SolrNamespaces } from '@/solr.js'
import { WellKnownKeys } from '@/cache.js'
import type { ImpressoApplication } from '@/types.js'
import { updateWellKnownEntry } from '@/internalServices/wellKnownCache.js'
import type { PreparedWellKnownEntry, UpdateWellKnownCacheOptions } from '@/internalServices/wellKnownCache.js'

export const prepareMediaSourcesCache = async (app: ImpressoApplication): Promise<PreparedWellKnownEntry> => {
  const dbClient = app.get('sequelizeClient')!
  const solrClient = app.service('simpleSolrClient')
  const sources = await consolidateMediaSources(dbClient, solrClient, SolrNamespaces.Search)
  return { key: WellKnownKeys.MediaSources, data: JSON.stringify(sources) }
}

const run = async (app: ImpressoApplication, options?: UpdateWellKnownCacheOptions): Promise<void> => {
  await updateWellKnownEntry(
    app.get('cacheManager'),
    WellKnownKeys.MediaSources,
    () => prepareMediaSourcesCache(app),
    options
  )
}

export default run
