import { prepareTopics } from '../useCases/prepareTopics'
import { WellKnownKeys } from '../cache'
import { ImpressoApplication } from '../types'
import { SolrNamespaces } from '../solr'

/**
 * Prepare topics and store them in cache.
 */
const run = async (app: ImpressoApplication) => {
  const cache = app.get('cacheManager')
  const solrClient = app.service('simpleSolrClient')

  const topics = await prepareTopics(solrClient)
  await cache.set(WellKnownKeys.Topics, JSON.stringify(topics))
}

export default run
