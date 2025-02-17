import { prepareTopics } from '../useCases/prepareTopics'
import { WellKnownKeys } from '../cache'
import { ImpressoApplication } from '../types'

/** 100 days */
const DefaultTtlSeconds = 60 * 60 * 24 * 100 * 1000

/**
 * Prepare topics and store them in cache.
 */
const run = async (app: ImpressoApplication) => {
  const cache = app.get('cacheManager')
  const solrClient = app.service('simpleSolrClient')

  const cached = await cache.get(WellKnownKeys.Topics)
  if (cached != null) return

  const topics = await prepareTopics(solrClient)
  await cache.set(WellKnownKeys.Topics, JSON.stringify(topics), DefaultTtlSeconds)
}

export default run
