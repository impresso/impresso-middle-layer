import { Configuration } from '../../configuration'
import { SelectRequestBody, CachingStrategy } from '../../internalServices/simpleSolr'
import { logger } from '../../logger'
import { SolrConfiguration } from '../../models/generated/common'
import { SolrNamespaces } from '../../solr'

const NotCacheableSolrFields = [
  'ucoll_ss', // collections ids
]

export const obsoleteDefaultCachingStrategy: CachingStrategy = (
  url: string,
  requestBody: string,
  responseBody: string
): 'cache' | 'bypass' => {
  const nonCacheableContentPresent = NotCacheableSolrFields.map(field => {
    return url.includes(field) || requestBody.includes(field) || responseBody.includes(field)
  })

  return nonCacheableContentPresent.some(Boolean) ? 'bypass' : 'cache'
}

/**
 * Ensures that direct and join requests to collection_items index are never cached.
 * This includes:
 *  - direct requests to collection_items
 *  - requests to other indexes that contain the name of the collection_items index in the body.
 */
export const notCachingCollectionItemsStrategyBuilder = (configuration: SolrConfiguration): CachingStrategy => {
  const namespace = configuration.namespaces?.find(ns => ns.namespaceId === SolrNamespaces.CollectionItems)
  const indexName = namespace?.index
  if (!indexName)
    throw new Error(`No index configured for collection items. Namespace: ${SolrNamespaces.CollectionItems}`)

  logger.info("Not caching requests to Solr where URL or request body contain '%s'", indexName)

  const strategy = (url: string, requestBody: string, responseBody: string): 'cache' | 'bypass' => {
    return url.includes(indexName) || requestBody.includes(indexName) ? 'bypass' : 'cache'
  }

  return strategy
}
